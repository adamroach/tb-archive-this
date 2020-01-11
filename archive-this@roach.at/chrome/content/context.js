"use strict";

var ArchiveThisContext =
{
  s : null,

  initOverlay : function()
  {
    ArchiveThisContext.s = document.getElementById("archive-ArchiveThisContext-string-bundle");
    var menu = document.getElementById("archive-ArchiveThisContext-context-menu");
    if (menu)
    {
      menu.addEventListener("popupshowing", ArchiveThisContext.setMenu, false);
    }
  },

  setMenu : function ()
  {
    if (ArchiveThisContext.s == null) { ArchiveThisContext.s = document.getElementById("archive-ArchiveThisContext-string-bundle"); }
    var prefs = Components.classes["@mozilla.org/preferences-service;1"]
                              .getService(Components.interfaces.nsIPrefService)
                              .getBranch("archive-ArchiveThisContext.");
//    prefs.QueryInterface(Components.interfaces.nsIPrefBranch);

    var preset = prefs.getCharPref("presets").split("|",9);

    var menu = document.getElementById("archive-ArchiveThisContext-context-menu");
    for (var i = 1; i <= 9; i++)
    {
      var item = document.getElementById("archive-ArchiveThisContext-move-preset-"+i);
      var name = ArchiveThisContext.getPrettyName(preset[i-1]);
      if (name)
      {
        //item.label = "Move to " + name;
        item.label = ArchiveThisContext.s.getFormattedString("moveToFolderString",[name]);
        item.hidden = false;
      }
      else
      {
        item.hidden = true;
      }
    }
  },

  getPrettyName : function(folderUri)
  {
    if (ArchiveThisContext.s == null) { ArchiveThisContext.s = document.getElementById("archive-ArchiveThisContext-string-bundle"); }

    var msgfolder;
    try
    {
      msgfolder = MailUtils.getFolderForURI(folderUri, true);
    }
    catch (err)
    {
      return null;
    }

    var folderName;
    if (msgfolder)
    {
      folderName = msgfolder.name;
      var p = msgfolder.parent;
      while (p && p.parent)
      {
        folderName = p.name+'/'+folderName;
        p = p.parent;
      }

      if (msgfolder.server.prettyName)
      {
        //folderName = '"' + folderName + '" on ' + msgfolder.server.prettyName;
        folderName = ArchiveThisContext.s.getFormattedString("prettyNameString",
                     [folderName, msgfolder.server.prettyName]);
      }
    }
    else
    {
      return null;
    }

    return folderName;

  }
}

window.addEventListener("load",ArchiveThisContext.initOverlay, false);
