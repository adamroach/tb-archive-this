"use strict";

// NOTE: The console logging in this is active only if the debug
// configuration option was active when Thunderbird was started.
// We're not going to bother processing configuration callbacks
// here just for debugging state.

var ArchiveThisMoveCopy =
{
  folders : new Array(),
  longFolderNames : new Array(),
  maxFolderNameLength : 0,
  mode : "move",
  archiveThis : null,
  currAccount : "",
  currCandidate : 0,
  dbConn : null,
  dbSelect: null,
  dbResults: null,
  dbQueryComplete: false,
  dbMaxPriority: 5,
  console: Components.classes["@mozilla.org/consoleservice;1"].
             getService(Components.interfaces.nsIConsoleService),
  debug: false,
  prefs: null,
  fragment: null,

  sortFolders : function(a, b)
  {
    // Prefer folders in the same account as the selected message
    if (   (a.server.prettyName == ArchiveThisMoveCopy.currAccount) 
        && (b.server.prettyName != ArchiveThisMoveCopy.currAccount)) 
        { return -1; }

    if (   (a.server.prettyName != ArchiveThisMoveCopy.currAccount) 
        && (b.server.prettyName == ArchiveThisMoveCopy.currAccount)) 
        { return 1; }

    if (a.URI < b.URI) { return -1; }
    if (a.URI > b.URI) { return 1; }
    return 0;
  },

  onLoad: function()
  {
    if (this.s == null) { this.s = document.getElementById("archive-this-string-bundle"); }

    if (!this.prefs)
    {
      this.prefs = Components.classes["@mozilla.org/preferences-service;1"].
        getService(Components.interfaces.nsIPrefService).getBranch("archive-this.");
      this.prefs.QueryInterface(Components.interfaces.nsIPrefBranch2);
    }

    this.debug = this.prefs.getBoolPref("debug");


    if (this.dbConn === null)
    {
      if (this.debug)
      {
        this.console.logStringMessage("Archive This: opening database");
      }

      Components.utils.import("resource://gre/modules/Services.jsm");
      Components.utils.import("resource://gre/modules/FileUtils.jsm");
       
      var file = FileUtils.getFile("ProfD", ["archive_this.sqlite"]);
      this.dbConn = Services.storage.openDatabase(file);

      try
      {
        // Create the table for mapping string fragments to preferred folders
        this.dbConn.executeSimpleSQL("CREATE TABLE IF NOT EXISTS stringmap (fragment TEXT, fraglen INTEGER, folder TEXT, priority INTEGER, timestamp INTEGER)");
      }
      catch (e)
      {
        if (this.debug)
        {
          this.console.logStringMessage("Archive This: Error creating table: " + e);
        }
      }

      this.dbSelect = this.dbConn.createStatement("SELECT * FROM stringmap WHERE fragment LIKE :frag ORDER BY fraglen, priority");
    }

    this.archiveThis = window.arguments[0];
    var headers = window.arguments[1];
    this.mode = window.arguments[2];

    this.archiveThis.selectedFolder = null;

    //////////////////////////////////////////////////////////////////////
    // Set up the window according to the selected mode
    var description = document.getElementById("mode")
    var dialog = document.getElementById("archive-this-move-copy");
    switch (this.mode)
    {
      case 'move':
        description.value=this.s.getString("moveToString")+": ";
        dialog.setAttribute("title", this.s.getString("moveTitleString"));
        break;

      case 'copy':
        description.value=this.s.getString("copyToString")+": ";
        dialog.setAttribute("title", this.s.getString("copyTitleString"));
        break;

      case 'go':
        document.getElementById("header-grid").hidden = true;
        document.getElementById("header-sep").hidden = true;
        description.value=this.s.getString("goToString")+": ";
        dialog.setAttribute("title", this.s.getString("goToTitleString"));
        break;

      default:
        description.value=this.s.getString("moveToString")+": ";
        dialog.setAttribute("title", this.s.getString("moveTitleString"));
        this.mode = 'move';
    }

    //////////////////////////////////////////////////////////////////////
    // Populate the header fields
    var subject = "";
    var from = "";
    var to = "";
    var account = "";

    for (var i in headers)
    {
      if (subject.length == 0) { subject = headers[i].mime2DecodedSubject; }
      if (from.length == 0) { from = headers[i].mime2DecodedAuthor; }
      if (to.length == 0) { to = headers[i].mime2DecodedRecipients; }
      if (account.length == 0) { account = headers[i].folder.server.prettyName; }

      if (subject != headers[i].mime2DecodedSubject) { subject = '<'+this.s.getString("severalString")+'>'; }
      if (from != headers[i].mime2DecodedAuthor) { from = '<'+this.s.getString("severalString")+'>'; }
      if (to != headers[i].mime2DecodedRecipients) { to ='<'+this.s.getString("severalString")+'>'; }
      if (account != headers[i].folder.server.prettyName) { account = '<'+this.s.getString("severalString")+'>'; }
    }

    document.getElementById("subject").setAttribute("value",subject);
    document.getElementById("from").setAttribute("value",from);
    document.getElementById("to").setAttribute("value",to);
    document.getElementById("account").setAttribute("value",account);
    this.currAccount = account;

    //////////////////////////////////////////////////////////////////////
    // Gather all the folders into an array

    var accountManager = Components.classes ["@mozilla.org/messenger/account-manager;1"].getService(Components.interfaces.nsIMsgAccountManager);
    var servers = accountManager.allServers;
    var numServers = servers.Count();
    for (var i = 0; i <numServers; i++)
    {
      var rootFolder = servers.GetElementAt(i).QueryInterface(Components.interfaces.nsIMsgIncomingServer).rootFolder;

      if (rootFolder)
      {
        var allFolders = Components.classes ["@mozilla.org/supports-array;1"].createInstance (Components.interfaces.nsISupportsArray);
        rootFolder.ListDescendents (allFolders);
        var numFolders = allFolders.Count ();
        for (var folderIndex = 0; folderIndex < numFolders; folderIndex++)
        {
          var cf = allFolders.GetElementAt(folderIndex).QueryInterface(Components.interfaces.nsIMsgFolder);
          // TODO - if this.mode is not 'go', exclude folders we can't
          // file into
          this.folders.push(cf);
        }
      }
   
    }

    this.folders.sort(this.sortFolders);

    //////////////////////////////////////////////////////////////////////
    // Make full, long names for each folder
    for (var i in this.folders)
    {
      var label = this.folders[i].prettiestName;
      var p = this.folders[i].parent;
      while (p && p.parent)
      {
        label = p.name+'/'+label;
        p = p.parent;
      }
      label = this.folders[i].server.prettyName + "/" + label;
      this.longFolderNames[i] = label;

      if (label.length > this.maxFolderNameLength)
      {
        this.maxFolderNameLength = label.length;
      }
    }

    dialog.setAttribute("minwidth",this.maxFolderNameLength * 9);

    // TODO -- This doesn't work, for some reason.
    dialog.setAttribute("maxwidth", screen.width);

    this.setCandidate(0);
    this.hideFolderList();
  },

  updateList: function()
  {
    var list = document.getElementById('folder-list');

    //////////////////////////////////////////////////////////////////////
    // Clear the folder list
     while(list.hasChildNodes()){
       list.removeChild(list.firstChild);
     }

    //////////////////////////////////////////////////////////////////////
    // Populate the folder list popup
    var searchText = document.getElementById("search").value;
    var bestFound = false;

    for (var i in this.folders)
    {
      if (this.longFolderNames[i].toLowerCase().indexOf(searchText.toLowerCase()) > -1)
      {
        list.appendItem(this.longFolderNames[i],i);

        if (!bestFound)
        {
          bestFound = true;
          this.setCandidate(i);
        }
      }
    }

    if (!bestFound)
    {
      this.setCandidate(this.currCandidate);
    }

    var f = this.fragment?this.fragment:document.getElementById("search").value;
    if (f.length)
    {
      this.dbSelect.params.frag = f + "%";
      this.dbResults = new Array();
      this.dbQueryComplete = false;
      this.dbSelect.executeAsync({
        handleResult: function (resultSet)
        {
          var row;
          while (row = resultSet.getNextRow())
          {
            ArchiveThisMoveCopy.handleRow(row);
          }
        },
        handleError: function (error)
        {
          ArchiveThisMoveCopy.debug && ArchiveThisMoveCopy.console.logStringMessage("Archive This: SELECT error: " + aError.message);
        },
        handleCompletion: function (reason)
        {
          // Mark set as complete so we know it's safe to store
          if (reason == Components.interfaces.mozIStorageStatementCallback.REASON_FINISHED)
          {
            ArchiveThisMoveCopy.dbQueryComplete = true;
          }
          else
          {
            ArchiveThisMoveCopy.debug && ArchiveThisMoveCopy.console.logStringMessage("Archive This: SELECT Failed, reason = " + reason);
          }
        }
      });
    }
  },

  handleRow : function (row)
  {
    var f = this.fragment?this.fragment:document.getElementById("search").value;
    var record = 
    {
      fragment : row.getResultByName("fragment"),
      fraglen : row.getResultByName("fraglen"),
      folder : row.getResultByName("folder"),
      priority : row.getResultByName("priority"),
      timestamp : row.getResultByName("timestamp")
    };
    this.debug && this.console.logStringMessage("Row match:\n" + this.dump(record));

    if (record['fragment'] == f)
    {
      this.dbResults.push(record);
    }

    // TODO Update folder list
    var list = document.getElementById('folder-list');
    // XXX Find entry
    // XXX Remove entry from folder list
    // XXX Re-insert at position corresponding to row #
  },

  onSearchKeyPress : function(event)
  {
    var list = document.getElementById('folder-list');
    var panel = document.getElementById("folder-panel");
    var offset = 0;

    // see https://developer.mozilla.org/en/DOM/Event/UIEvent/KeyEvent
    switch (event.keyCode)
    {
      case event.DOM_VK_DOWN:      offset = 1; break;
      case event.DOM_VK_UP:        offset = -1; break;
      case event.DOM_VK_PAGE_DOWN: offset = list.getNumberOfVisibleRows(); break;
      case event.DOM_VK_PAGE_UP:   offset = -(list.getNumberOfVisibleRows()); break;

      case event.DOM_VK_ENTER:
      case event.DOM_VK_TAB:
        this.hideFolderList();
        return true;
        break;

      case event.DOM_VK_ESCAPE:
        var stateChanged = this.hideFolderList();
        if (stateChanged) { return false; }
        return true;
        break;
    }

    this.showFolderList();

    if (offset != 0)
    {
      if (!this.fragment)
      {
        this.fragment = document.getElementById("search").value;

        if (this.debug)
        {
          this.console.logStringMessage("Archive This: saving typed fragment (kb) = " + this.fragment);
        }
      }

      if (list.selectedItem == null)
      {
        list.selectedIndex = 0;
      }
      list.moveByOffset(offset, true, false);
      return false;
    }
    else if (event.keyCode == 0)
    {
      if (0 && this.debug)
      {
        this.console.logStringMessage("Archive This: resetting saved fragment: " + event.keyCode);
      }
      this.fragment = null;
    }

    return true;
  },

  onSearchBlur : function()
  {
    this.hideFolderList();
  },

  hideFolderList : function()
  {
    var stateChanged = false;

    var appInfo = Components.classes["@mozilla.org/xre/app-info;1"]
                  .getService(Components.interfaces.nsIXULAppInfo);
    var versionChecker = Components.classes["@mozilla.org/xpcom/version-comparator;1"]
                                   .getService(Components.interfaces.nsIVersionComparator);
    if(versionChecker.compare(appInfo.version, "3.0b3") >= 0)
    {
      var panel = document.getElementById("folder-panel");
      if (panel.state == "open") { stateChanged = true; }
      panel.hidePopup();
    }
    else
    {
      var panel = document.getElementById("folder-panel");
      if (!panel.hidden) { stateChanged = true; }
      panel.hidden=true;
      window.sizeToContent();
    }

    return stateChanged;
  },

  showFolderList : function()
  {
    var appInfo = Components.classes["@mozilla.org/xre/app-info;1"]
                  .getService(Components.interfaces.nsIXULAppInfo);
    var versionChecker = Components.classes["@mozilla.org/xpcom/version-comparator;1"]
                                   .getService(Components.interfaces.nsIVersionComparator);
    if(versionChecker.compare(appInfo.version, "3.0b3") >= 0)
    {
      var panel = document.getElementById("folder-panel");
      var search = document.getElementById("search");
      panel.openPopup(search,'after_start');
    }
    else
    {
      var panel = document.getElementById("folder-panel");
      panel.hidden=false;
      window.sizeToContent();
    }

  },

  onFolderListShowing : function()
  {
    var panel = document.getElementById("folder-panel");
    var search = document.getElementById("search");
    panel.sizeTo(search.clientWidth, search.clientHeight*10);

    //panel.moveTo(search.clientLeft,search.clientTop+search.clientHeight);

    this.updateList();
  },

  onFolderListShown : function()
  {
    var list = document.getElementById('folder-list');
  },

  onFolderListSelect : function()
  {
    var list = document.getElementById('folder-list');
    var search = document.getElementById("search");

    if (!this.fragment)
    {
      this.fragment = search.value;

      if (this.debug)
      {
        this.console.logStringMessage("Archive This: saving typed fragment = " + this.fragment);
      }
    }

    if (list.getSelectedItem(0) != null)
    {
      search.value = list.getSelectedItem(0).label;
      this.setCandidate(list.getSelectedItem(0).value);
      search.select();
    }

  },

  updateStringmap: function(fragment, folder)
  {
    if (this.debug)
    {
      this.console.logStringMessage("Archive This: Associating fragment " +
        fragment + " with folder " + folder);
    }

    // Update stringmap table
    if (ArchiveThisMoveCopy.dbQueryComplete)
    {
      if (this.dbResults.length == 0)
      {
        this.dbResults.push({
          fragment : fragment,
          fraglen : fragment.length,
          folder : folder,
          priority : 1,
          timestamp : new Date().getTime()
        });
      }
      else if (this.dbResults.length > 1 && this.dbResults[1]['folder'] == folder)
      {
        // already 2nd -- swap priorities of 1st and 2nd element
        this.dbResults[1]['priority'] = 1;
        this.dbResults[1]['timestamp'] = new Date().getTime();
        this.dbResults[0]['priority'] = 2;
      }
      else if (this.dbResults.length > 0 && this.dbResults[0]['folder'] == folder)
      {
        // Already in first place, no need to change record priorities. Update date.
        this.dbResults[0]['timestamp'] = new Date().getTime();
      }
      else
      {
        // Need to put in 2nd place. Rather than changing the priorties in-place,
        // it's easier to reorder them and then renumber the priorities once they're
        // in the right order.

        var moved = false;
        // Iterate over array and figure out if already in array;
        // if so, promote to 2nd place
        for (var i = 2; i < this.dbResults.length && !moved; i++)
        {
          if (this.dbResults[i]['folder'] == folder)
          {
            var temp = this.dbResults[i];
            this.dbResults.splice(i,1);
            this.dbResults.splice(1,0,temp);
            moved = true;
          }
        }

        // If not present in array. Put in 2nd place, knock off 5th
        // place entry (if present)
        if (!moved)
        {
          var temp = {
            fragment : fragment,
            fraglen : fragment.length,
            folder : folder,
            priority : 2,
            timestamp : new Date().getTime()
          };
          this.dbResults.splice(1,0,temp);
          if (this.dbResults.length > this.dbMaxPriority)
          {
            this.dbResults.length = this.dbMaxPriority;
          }
        }

        // Renumber priorities
        for (i = 0; i < this.dbResults.length; i++)
        {
          this.dbResults[i]['priority'] = i+1;
        }
      }

      // Delete existing entries
      var del = this.dbConn.createStatement("DELETE FROM stringmap WHERE fragment = :frag");
      del.params.frag = fragment;
      del.executeAsync({handleCompletion: function(r){}});

      // Insert new entries
      var ins = this.dbConn.createStatement("INSERT INTO stringmap VALUES (:fragment, :fraglen, :folder, :priority, :timestamp)");
      for (var i = 0; i < this.dbResults.length; i++)
      {
        ins.params.fragment = this.dbResults[i].fragment;
        ins.params.fraglen = this.dbResults[i].fraglen;
        ins.params.folder = this.dbResults[i].folder;
        ins.params.priority = this.dbResults[i].priority;
        ins.params.timestamp = this.dbResults[i].timestamp;
        if (this.debug)
        {
          this.console.logStringMessage("Archive This: Inserting fragment record:\n" 
            + this.dump(this.dbResults[i]));
        }
        ins.executeAsync({handleCompletion: function(r){}});
      }
    }
    else if (this.debug)
    {
      this.console.logStringMessage("Archive This: Not saving string fragment: query incomplete");
    }
  },

  onAccept: function()
  {
    var candidate = document.getElementById('candidate');
    this.archiveThis.selectedFolder = candidate.tooltipText;

    // Store the fragment-to-folder binding in the database
    var f = this.fragment?this.fragment:document.getElementById("search").value;

    this.updateStringmap(f, candidate.tooltipText);

    return true;
  },

  setCandidate : function(index)
  {
    this.currCandidate = index;
    var candidate = document.getElementById('candidate');

    // Reset the contents of the candidate field
    candidate.removeAttribute("value");
    while(candidate.hasChildNodes()){
      candidate.removeChild(candidate.firstChild);
    }

    // Generate the new value, with the matched string highlighted
    var searchText = document.getElementById("search").value;
    var folderName = this.longFolderNames[index];
    var matchStart = this.longFolderNames[index].toLowerCase().
                       indexOf(searchText.toLowerCase());
    var matchEnd = matchStart + searchText.length;

    if (matchStart >= 0)
    {
      var matchSpan = document.createElement('box');
      matchSpan.setAttribute('class','match-string');
      matchSpan.appendChild(document.createTextNode(folderName.substring(matchStart,matchEnd).replace(' ','\u00A0','g')));

      candidate.appendChild(document.createTextNode(folderName.substring(0,matchStart)));
      candidate.appendChild(matchSpan);
      candidate.appendChild(document.createTextNode(folderName.substring(matchEnd)));
    }
    else
    {
      candidate.appendChild(document.createTextNode(folderName));
    }

    candidate.tooltipText = this.folders[index].URI;
  },

  shutdown : function()
  {
    if (this.debug)
    {
      this.console.logStringMessage("Archive This: closing database");
    }
    this.dbConn.asyncClose();
    this.dbConn = null;
  },

  dump : function (o)
  {
    var str = "";
    for (var f in o)
    {
      str += "  " + f + ": " + o[f] + "\n";
    }
    return str;
  }

}
