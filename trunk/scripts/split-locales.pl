#!/usr/bin/perl

open (FILE, "|cat");

while (<>)
{
  if (/^ *\+\+\+ chrome\/locale\/([^\/]*)\/(.*)/)
  {
    $lang = $1;
    $file = $2;
    print "\n$file\n";
    if (! -e $lang) {mkdir ($lang);}
    close (FILE);
    open (FILE, ">$lang/$file") || die $!;
  }
  else
  {
    print FILE
  }
}

close (FILE);
