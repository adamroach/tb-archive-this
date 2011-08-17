all: xpi

VERSION := $(shell grep em:version archive-this@roach.at/install.rdf | cut -f2 -d'"')

xpi:
	@echo Creating XPI for version ${VERSION}
	cd archive-this@roach.at && zip -q -9 -r ../archive_this-${VERSION}-tb.xpi * -x \*/.\*

web:
	rsync --exclude '.*' --delete -avP -e ssh webpage/ adamroach,tb-archive-this@frs.sourceforge.net:htdocs/

clean:
	@echo $(RM) *.xpi
	@[ -e *.xpi ] && $(RM) *.xpi || true
