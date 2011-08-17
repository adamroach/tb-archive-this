"use strict";

var ArchiveThis = {

prefs: null,
preset: null,
rules: null,
selectedFolder: null,
console: Components.classes["@mozilla.org/consoleservice;1"].
           getService(Components.interfaces.nsIConsoleService),
debug: false,
newFolderStyle: false,
overrideKeys: false,

moveToFolderByUri: function(uri)
{
  if(this.newFolderStyle)
  {
    if (this.debug)
    {
        var messageUriArray = gFolderDisplay.selectedMessageUris;
        this.console.logStringMessage("Archive This: Moving [" 
             + messageUriArray.join(', ') + "] to " + uri);
    }

    var folder = MailUtils.getFolderForURI(uri, false);
    MsgMoveMessage(folder);
  }
  else
  {
    var messageUriArray = GetSelectedMessages();
    if (messageUriArray == null || messageUriArray.length == 0)
    {
      if (this.debug)
      {
        this.console.logStringMessage("Archive This: No selected messages.");
      }
      return;
    }
    if (this.debug)
    {
        this.console.logStringMessage("Archive This: Moving [" 
             + messageUriArray.join(', ') + "] to " + uri);
    }
    MsgMoveMessage(uri);
  }
},

copyToFolderByUri: function(uri)
{
  if(this.newFolderStyle)
  {
    var folder = MailUtils.getFolderForURI(uri, false);
    MsgCopyMessage(folder);
  }
  else
  {
    MsgCopyMessage(uri);
  }
},

goToFolderByUri: function(uri)
{
  if(this.newFolderStyle)
  {
    var folder = MailUtils.getFolderForURI(uri, false);
    gFolderTreeView.selectFolder(folder);
  }
  else
  {
    var view = document.getElementById("folderTree").view;
    for (var i = 0; i < view.rowCount; ++i)
    {
      var resource = view.getResourceAtIndex(i);
      uri == resource.Value? view.selection.select(i) :
      uri.indexOf(resource.Value) == 0 && !view.isContainerOpen(i)? view.toggleOpenState(i) : null;
    }

/*  Not kosher for "use strict" -- I'm leaving it here for now in case the above code breaks...
    with (document.getElementById("folderTree").view)
      for (var i = 0; i < rowCount; ++i) with (getResourceAtIndex(i))
        uri == Value? selection.select(i) :
        uri.indexOf(Value) == 0 && !isContainerOpen(i)? toggleOpenState(i) : null;
*/
  }
},

loadFilters: function()
{
  this.rules = new Array();
  var ruleText = this.prefs.getCharPref("filters").split("||");
  for (var i = 0; i < ruleText.length; i++)
  {
    var rule = archiveThisClone(ArchiveRule);
    rule.init(ruleText[i]);
    this.rules.push(rule);
  }
},

loadPrefs: function()
{
  if (!this.prefs)
  {
    this.prefs = Components.classes["@mozilla.org/preferences-service;1"]
                              .getService(Components.interfaces.nsIPrefService)
                              .getBranch("archive-this.");
    this.prefs.QueryInterface(Components.interfaces.nsIPrefBranch2);
    this.prefs.addObserver("", this, false);
  }

  this.debug = this.prefs.getBoolPref("debug");
  if (this.debug)
  {
    this.console.logStringMessage("Archive This: Debugging enabled at startup.");
  }

  this.preset = this.prefs.getCharPref("presets").split("|",9);
  this.loadFilters();
},

findFolderUri: function (messageUri, header){
    var mimeHeader;
    mimeHeader = mdn_extended_createHeadersFromURI(messageUri);

//    alert(header.mime2DecodedAuthor + "\n" + mimeHeader.extractHeader("Message-ID",false) + "\n" + messageUri + "\n" + header.folder.URI);

    for (var i = 0; i < this.rules.length; i++)
    {
      if (this.rules[i].matches(header,mimeHeader))
      {
        if (this.debug)
        {
          this.console.logStringMessage("Archive This: Found matching filter: " +
          this.rules[i].header + ": " + this.rules[i].value + " => " + this.rules[i].folder );
        }
        return this.rules[i].folder;
      }
    }

    if (this.debug)
    {
      this.console.logStringMessage("Archive This: No matching filter found.");
    }

    return "";
  },

folder: function(preset) {
  if (this.debug)
  {
    this.console.logStringMessage("Archive This: executing preset " + preset);
  }

  if (!this.prefs) { this.loadPrefs(); }
  var uri = this.preset[preset-1];

  if (uri && uri.indexOf("special:") == 0)
  {
    this.moveToSpecialFolder(uri.substr(8));
    return;
  }

  if (uri.length > 0)
  {
    this.moveToFolderByUri(uri);
  }
},

moveToSpecialFolder : function (folder)
{
  var flags = 0;
  switch (folder)
  {
    case "Inbox":      flags = 0x1000; break;
    case "Trash":      flags = 0x0100; break;
    case "Sent":       flags = 0x0200; break;
    case "Drafts":     flags = 0x0400; break;
    case "Templates":  flags = 0x400000; break;
  }

  ////////////////////
  // Gather the array of message headers and their URIs
  var messages = [];
  var messageURIs = [];

  if (this.newFolderStyle)
  {
    messages = gFolderDisplay.selectedMessages;
    messageURIs = gFolderDisplay.selectedMessageUris;
  }
  else
  {
    messageURIs = GetSelectedMessages();
    for (var i in messageURIs)
    {
      messages[i] = messenger.msgHdrFromURI(messageURIs[i]);
    }
  }

  for (var i in messages)
  {
    // Figure out the special folder for this message
    var rootFolder = messages[i].folder.server.rootFolder;
    var allFolders = Components.classes ["@mozilla.org/supports-array;1"].createInstance (Components.interfaces.nsISupportsArray);
    rootFolder.ListDescendents (allFolders);
    var numFolders = allFolders.Count ();
    for (var folderIndex = 0; folderIndex < numFolders; folderIndex++)
    {
      var cf = allFolders.GetElementAt(folderIndex).QueryInterface(Components.interfaces.nsIMsgFolder);
      if (cf.flags & flags)
      {
        this.console.logStringMessage("Archive This: Found special folder '"+folder+
          "' for ["+messageURIs[i]+"]: " + cf.URI);
        if (this.newFolderStyle) { gFolderDisplay.selectMessage(messages[i]); }
        else { SelectMessage(messageURIs[i]); }
        this.moveToFolderByUri(cf.URI);
        folderIndex = numFolders;
      }
    }

  }

},

filter: function(createIfNotFound)
{
  if (this.debug)
  {
    this.console.logStringMessage("Archive This: executing filters");
  }
  if(this.newFolderStyle)
  {
    this.newFilter(createIfNotFound);
  }
  else
  {
    this.oldFilter(createIfNotFound);
  }
},

// This is the function for 3.0b3, which changed the folder interface
// fairly radically. It is *much* cleaner, and works better than the
// older interface.
newFilter: function (createIfNotFound) 
{
  if (!this.prefs) { this.loadPrefs(); }

  var folderUri;
  var messageArray = gFolderDisplay.selectedMessages;
  var messageUriArray = gFolderDisplay.selectedMessageUris;
  if (!messageArray)
  {
    return;
  }

  var selectArray = [];
  var header;
  for (var i = 0; i < messageArray.length; i++)
  {
    header = messageArray[i];
    folderUri = this.findFolderUri(messageUriArray[i], header);
    gFolderDisplay.selectMessage(messageArray[i]);
    if (folderUri.length > 0)
    {
      //MsgMoveMessage(MailUtils.getFolderForURI(folderUri, false));
      this.moveToFolderByUri(folderUri);
    }
    else
    {
      selectArray[selectArray.length] = header;
      if (messageArray.length == 1 && createIfNotFound)
      {
        this.createFilterFromMessage();
      }
    }
  };

  if (selectArray.length > 0)
  {
    gFolderDisplay.selectMessages(selectArray);
  }
},

// This is the function for 2.0 through 3.0b2
oldFilter: function (createIfNotFound) 
{
  if (!this.prefs) { this.loadPrefs(); }

  var folderUri;
  var messageArray = GetSelectedMessages();
  if (!messageArray)
  {
    return;
  }

  var selectArray = [];
  var header;
  for (var i = 0; i < messageArray.length; i++)
  {
    header = messenger.msgHdrFromURI(messageArray[i]);
    folderUri = this.findFolderUri(messageArray[i], header);
    SelectMessage(messageArray[i]);
    if (folderUri.length > 0)
    {
      //MsgMoveMessage(folderUri);
      this.moveToFolderByUri(folderUri);
    }
    else
    {
      selectArray[selectArray.length] = header.messageKey;

      if (messageArray.length == 1 && createIfNotFound)
      {
        this.createFilterFromMessage();
      }
    }
  };

  // Can't figure out how to select more than one message...
  if (selectArray.length > 0)
  {
    gDBView.selectMsgByKey(selectArray[0]);
  }
},


createFilterFromMessage : function()
{
  var header;
  var uri;

  if(this.newFolderStyle)
  {
    header = gFolderDisplay.selectedMessages[0];
    uri = gFolderDisplay.selectedMessageUris[0];
  }
  else
  {
    var messageArray = GetSelectedMessages();
    uri = messageArray[0];
    header = messenger.msgHdrFromURI(uri);
  }

  window.openDialog('chrome://archive-this/content/filter.xul','filter',
                    'chrome,modal', 'To or Cc',1,'','',
                     ArchiveThis['addRule'],
                     header,
                     mdn_extended_createHeadersFromURI(uri));
},

addRule : function (headerName,comparitor,headerValue,folder)
{
  if (!ArchiveThis.prefs) { ArchiveThis.loadPrefs(); }

  var rule = headerName + "|" + comparitor + "|" + headerValue + "|" + folder;
  var allrules = ArchiveThis.prefs.getCharPref("filters").split("||");
  allrules.push(rule);
  ArchiveThis.prefs.setCharPref("filters",allrules.join('||'));

  ArchiveThis.loadFilters();
},

shutdown: function()
{
  this.prefs.removeObserver("", this);
},

observe: function(subject, topic, data)
{
  if (topic != "nsPref:changed")
  {
    return;
  }

  switch(data)
  {
    case "presets":
      this.preset = this.prefs.getCharPref("presets").split("|",9);
      break;
    case "filters":
      this.loadFilters();
      break;
    case "keys":
      this.bindKeys();
      break;
    case "debug":
      this.debug = this.prefs.getBoolPref("debug");
      if (this.debug)
      {
        this.console.logStringMessage("Archive This: Debugging enabled.");
      }
  }
},

init : function ()
{
  ArchiveThisKeyUtils.init();

  var appInfo = Components.classes["@mozilla.org/xre/app-info;1"]
                          .getService(Components.interfaces.nsIXULAppInfo);
  var versionChecker = Components.classes["@mozilla.org/xpcom/version-comparator;1"]
                                 .getService(Components.interfaces.nsIVersionComparator);
  this.newFolderStyle = (versionChecker.compare(appInfo.version, "3.0b3") >= 0) 

  if (!this.prefs) { this.loadPrefs(); }
  
  this.bindKeys();
},

bindKeys : function()
{
  if (!this.prefs) { this.loadPrefs(); }

  ArchiveThisKeyUtils.reEnableKeys();

  var keys = new Array();
  keys = this.prefs.getCharPref("keys").split("|");

  if (this.debug)
  {
    this.console.logStringMessage("Archive This: Binding keys.");
  }

  var win = document.getElementById("messengerWindow");
  var keyset = document.getElementById("archive-this-keys");
  win.removeChild(keyset);
  keyset = document.createElement('keyset');
  keyset.id = "archive-this-keys";

  for (var i = 0; i < keys.length / 2; i++)
  {
    var key = document.createElement('key');

    key.setAttribute('id',"archive-this-key-" + i);
    key.setAttribute("modifiers",keys[i*2]);

    if (i == 0)
    {
      // This doesn't work. I suspect it should, but it doesn't. So
      // I need to do the apparently deprecated setAttribute thing
      // instead.
      //
      //key.oncommand = function() { ArchiveThis.filter(true); };

      key.setAttribute('oncommand',"ArchiveThis['filter'](true)");
    }
    else if (i < 10)
    {
      // This doesn't work. I suspect it should, but it doesn't. So
      // I need to do the apparently deprecated setAttribute thing
      // instead.
      //
      //key.oncommand = function() { ArchiveThis.folder(i); };

      key.setAttribute('oncommand',"ArchiveThis['folder']("+i+")");
    }
    else
    {
      switch (i)
      {
        case 10:
          // Deprecated, but alternate methods do not work. Will fix when 
          // a preferred and functional alternative exists.
          key.setAttribute('oncommand',"ArchiveThis['moveToFolder']()");
          break;
        case 11:
          // Deprecated, but alternate methods do not work. Will fix when 
          // a preferred and functional alternative exists.
          key.setAttribute('oncommand',"ArchiveThis['copyToFolder']()");
          break;
        case 12:
          // This is what the addon center claims to want. Which would be
          // peachy, if it worked. But it doesn't. So we just have to
          // ignore the warnings about using 'oncommand'.
          //
          // key.addEventListener("command",function(){ArchiveThis.goToFolder();},false);

          key.setAttribute('oncommand',"ArchiveThis['goToFolder']()");
          break;
      }
    }

    var keycode = keys[(i*2)+1];
    if (keycode.length == 1)
    {
      key.setAttribute("key",keycode);
    }
    else
    {
      key.setAttribute("keycode",keycode);
    }
    keyset.appendChild(key);

    if (this.debug)
    {
      this.console.logStringMessage("Archive This: Binding " + 
        ArchiveThisKeyUtils.normalize(keys[i*2],keycode) + " to " + 
        key.getAttribute('oncommand'));
    }

    if (this.overrideKeys)
    {
      ArchiveThisKeyUtils.disableKey(keys[i*2],keycode);
    }
  }

  win.appendChild(keyset);
},

getSelectedHeaders : function()
{
  var headers = [];
  if(this.newFolderStyle)
  {
    headers = gFolderDisplay.selectedMessages;
  }
  else
  {
    var selected = GetSelectedMessages();
    for (var i in selected)
    {
      headers.push(messenger.msgHdrFromURI(selected[i]));
    }
  }
  return headers;
},

moveToFolder : function()
{
  var headers = this.getSelectedHeaders();
  if (headers.length == 0) { return; }
  window.openDialog('chrome://archive-this/content/move-copy.xul','move-copy',
                    'chrome,modal',this,headers,'move');
  if (this.selectedFolder)
  {
    this.moveToFolderByUri(this.selectedFolder);
  }
},

copyToFolder : function()
{
  var headers = this.getSelectedHeaders();
  if (headers.length == 0) { return; }
  window.openDialog('chrome://archive-this/content/move-copy.xul','move-copy',
                    'chrome,modal',this,headers,'copy');
  if (this.selectedFolder)
  {
    this.copyToFolderByUri(this.selectedFolder);
  }
},

goToFolder : function()
{
  window.openDialog('chrome://archive-this/content/move-copy.xul','move-copy',
                    'chrome,modal',this,[],'go');
  if (this.selectedFolder)
  {
    this.goToFolderByUri(this.selectedFolder);
  }
},

openPrefs : function()
{
  window.openDialog('chrome://archive-this/content/prefs.xul',
                    'prefs','centerscreen,chrome');
}

}

/*----------------------------------------------------------------------
  The following license block applies to the code that follows it.
  It has been borrowed from the mdn_extended plugin.
----------------------------------------------------------------------*/

/* -*- Mode: Java; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 * ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is mozilla.org Code.
 *
 * The Initial Developer of the Original Code is
 * BT Global Services / Etat  français  Ministère de la Défense
 * Portions created by the Initial Developer are Copyright (C) 1998-2001
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 * Eric Ballet Baz BT Global Services / Etat français Ministère de la Défense
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */


function mdn_extended_createHeadersFromURI(messageURI) {  
    var messageService = messenger.messageServiceFromURI(messageURI);
    var messageStream = Components.classes["@mozilla.org/network/sync-stream-listener;1"].createInstance().QueryInterface(Components.interfaces.nsIInputStream);
    var inputStream = Components.classes["@mozilla.org/scriptableinputstream;1"].createInstance().QueryInterface(Components.interfaces.nsIScriptableInputStream);
    inputStream.init(messageStream);
    var newuri = messageService.streamMessage(messageURI,messageStream, msgWindow, null, false, null);

    var content = "";
    inputStream.available();
    while (inputStream.available()) {
        content = content + inputStream.read(512);
        var p = content.indexOf("\r\n\r\n");
        var p1 = content.indexOf("\r\r");
        var p2 = content.indexOf("\n\n");
        if (p > 0) {
          content = content.substring(0, p);
          break;
        }
        if (p1 > 0) {
          content = content.substring(0, p1);
          break;
        }
        if (p2 > 0) {
          content = content.substring(0, p2);
          break;
        }
        if (content.length > 1024 * 8)
        {
          throw "Could not find end-of-headers line.";
          return null;
        }
    }
    content = content + "\r\n";

    var headers = Components.classes["@mozilla.org/messenger/mimeheaders;1"].createInstance().QueryInterface(Components.interfaces.nsIMimeHeaders);
    headers.initialize(content, content.length);
    return headers;
}

