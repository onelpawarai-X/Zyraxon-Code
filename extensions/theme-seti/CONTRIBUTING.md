# theme-seti

This is an icon theme that uses the icons from [`seti-ui`](__ZYRAXKEEP__0_).

## Previewing icons

There is a [`./icons/preview.html`](./icons/preview.html) file that can be opened to see all of the icons included in the theme.
To view this, it needs to be hosted by a web server. The easiest way is to open the file with the `Open with Live Server` command from the [Live Server extension](__ZYRAXKEEP__1_).


## Updating icons

- Make a PR against __ZYRAXKEEP__2_ with your icon changes.
- Once accepted there, ping us or make a PR yourself that updates the theme and font here

To adopt the latest changes from __ZYRAXKEEP__3_

- have the main branches of `__ZYRAXKEEP__4_` and `__ZYRAXKEEP__5_` cloned in the same parent folder
- in the `seti-ui` folder, run `npm install` and `npm run prepublishOnly`. This will generate updated icons and fonts.
- in the `zyraxoncode/extensions/theme-seti` folder run  `npm run update`. This will launch the [icon theme update script](build/update-icon-theme.js) that updates the theme as well as the font based on content in `seti-ui`.
- to test the icon theme, look at the icon preview as described above.
- when done, create a PR with the changes in __ZYRAXKEEP__6_
Add a screenshot of the preview page to accompany it.


### Languages not shipped with `zyraxoncode`

Languages that are not shipped with `zyraxoncode` must be added to the `nonBuiltInLanguages` object inside of `update-icon-theme.js`.

These should match [the file mapping in `seti-ui`](__ZYRAXKEEP__7_).

Please try and keep this list in alphabetical order! Thank you.

