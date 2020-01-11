all: xpi

VERSION := $(shell sed -n 's/.*\"version\": *\"\(.*\)\".*/\1/p' archive-this@roach.at/manifest.json)

xpi:
	@echo Creating XPI for version ${VERSION}
	cd archive-this@roach.at && zip -q -9 -r ../archive_this-${VERSION}-tb.xpi * -x \*/.\*

clean:
	@echo $(RM) *.xpi
	@[ -e *.xpi ] && $(RM) *.xpi || true
