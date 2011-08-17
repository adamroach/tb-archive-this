"use strict";

var ArchiveThisMoveCopy =
{
  folders : new Array(),
  longFolderNames : new Array(),
  maxFolderNameLength : 0,
  mode : "move",
  archiveThis : null,
  currAccount : "",
  currCandidate : 0,

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
      if (list.selectedItem == null)
      {
        list.selectedIndex = 0;
      }
      list.moveByOffset(offset, true, false);
      return false;
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

    search.value = list.getSelectedItem(0).label;
    search.select();

    this.setCandidate(list.getSelectedItem(0).value);
  },

  onAccept: function()
  {
    var candidate = document.getElementById('candidate');
    this.archiveThis.selectedFolder = candidate.tooltipText;
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
  }

}
