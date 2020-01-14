If you're reading this, it's probably because you're one of the folks who reached out to
me regarding the compatibility issues that Archive This has with Thunderbird
68. I wanted to let you know that I finally finished the changes required
to get the add-on working again. I apologize that this took so long; the
changes to make things work with Thunderbird 68 were far more substantial than
what has been required by previous updates to Thunderbird.

I've submitted the new add-on to the Thunderbird add-ons website, and it
should become available as soon as it is approved (this may take a bit of
time -- as of January 13th, there are 18 add-ons in line for review ahead of mine).

In the interim, you can use [this XPI file](https://github.com/adamroach/tb-archive-this/raw/master/archive_this-1.5.0.0-tb.xpi) to install the add-on
manually. (In the add-ons manager, click on the gear icon near the upper-right
corner, and select "Install add-on from file".)

There are two things you should be aware of. The first is that the changes
from Thunderbird 60 to Thunderbird 68 were large enough that it was not
reasonable to keep compatibility with Thunderbird 60. So this add-on will
install in 68, but not 60. If you've held off upgrading, you need to move to
68 and then install the add-on.

The second thing is that the folder picker that I used to use has changed
enough that it can't be used from add-ons anymore (or, if it can be, I'm not
clever enough to figure out how). My solution to this (for the time being, at
least) is to simply list all folders in a single, long list for you to select
from. I'm hoping that the relative infrequency of having to select a folder in
this way makes it a tolerable work-around.

In terms of future plans: I first wrote Archive This back in the Thunderbird 2
era -- in fact, during this fix, I found myself removing code that was only
present to work with pre-3.0 versions. A lot has changed with the Thunderbird
add-ons landscape since then, and I've learned a lot about the limitations of
my initial design. My hope is that, between now and the Thunderbird 88
release, I'll find time to re-write Archive This using the modern
MailExtensions APIs, which should stop the recurring need to update the add-on
every time a new version of Thunderbird comes out. If all goes well, you
should see an "Archive This 2.0" out sometime in the next year or so. There
will definitely be some changes, but I intend to keep the core functionality
in place.

Thanks for all of the encouraging words, and I'm happy you've found my
contribution to the Thunderbird ecosystem to be valuable enough to check in.
