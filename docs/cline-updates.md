Remember to rebuild the extension and install it using the cli specified on the `Roo-Cline/README.md` file, also remember to change directory to the `Roo-Cline` folder before running the commands from the readme.

Consider that any `export` or `install` command has already been run, so exclude those.ˆ

Before editing the file 'Roo-Cline/src/core/Cline.ts', since it's a really large file, read the original file to understand its full content.
Then create a new file with the -updates suffix containing ONLY the changes you've made to the original file.


In interactive mode, browser actions are disabled (if (!this.isInteractive) check in doAction method)
The navigateToUrl method uses doAction, which means navigation won't work in interactive mode

Can we analyze 'Roo-Cline/src/core/Cline.ts' to see how it handles browser actions and if there's some logic preventing it from using 'doAction'