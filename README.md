# wubbzp.com

The source for [wubbzp.com](https://wubbzp.com), the official website of WubbzP (Mitch "Michelle" Bentz), a vocal synth cover artist, archiver and visual designer. It's a personal hub for WubbzP's music releases, archive projects and fan web work.

## What's on the site

- **Home** (`/`): a featured video, the upcoming *Wow! Wow! Wubbzy! Cover Collection, Vol. 1*, a visitor counter and the latest news.
- **About** (`/about/`): WubbzP's bio, quick facts and a timeline.
- **Music** (`/music/`): the full discography, with a section for each album and cover compilation listing its editions, release dates, track counts and cover art, plus where to find the music online.
- **Links** (`/links/`): WubbzP's YouTube channels, Niconico, iWubbzy, the (Unofficial) Shiki Taigen Blog, Discord, Twitter, Last.fm and GitHub.
- **Contact** (`/contact/`): e-mail and Discord details.

## Design

The site's look is a tribute to the 2008 *Wow! Wow! Wubbzy!* website: the blue framed stage over the town background, the purple ribbon menu, the cyan sidebar and the green panels. Some artwork and fonts from the original site are reused, including the green panel, the cream and BACK buttons, the CLOSE X button, the character icons, House Holiday Sans and VAG Rounded.

## How it's built

wubbzp.com is a plain static website (HTML, CSS and a small amount of JavaScript) with no build step or framework. It's hosted on GitHub Pages using the custom domain in `CNAME`.

| Path | What it is |
| --- | --- |
| `index.html` | Home page |
| `about/`, `music/`, `links/`, `contact/` | The other pages |
| `404.html` | The "page not found" page |
| `channels/` | Forwards old `/channels/` links to `/links/` |
| `artstudio/` | A playable fan recreation of the Art Studio from *SpongeBob SquigglePants* (Wii, 2011), built from the game's own art and music; self-contained, with its own assets |
| `assets/css/style.css` | Styles shared by every page |
| `assets/js/site.js` | Scripts shared by every page: the Music and Links lists, the visitor counter, the copy buttons and the pronunciation button |
| `assets/fonts/` | House Holiday Sans and VAG Rounded |
| `assets/images/` | Site images; `original/` and `characters/` hold the artwork from the original *Wow! Wow! Wubbzy!* site |
| `assets/audio/` | The "How to Pronounce WubbzP" clip |
| `.well-known/at-proto-did` | Links the domain to WubbzP's Bluesky account |

Each page loads the stylesheet and script with a `?v=` version tag, so visitors get the latest version as soon as it changes.

## Outside services

- [Font Awesome](https://fontawesome.com) for icons.
- [Google Fonts](https://fonts.google.com) for Mochiy Pop One, used for Japanese text on the Music page.
- [Cover Art Archive](https://coverartarchive.org) for album and edition cover art.
- YouTube for the featured video on the home page.
- [Abacus](https://abacus.jasoncameron.dev) for the visitor counter, which has counted visits since 19 October 2026.

## Credits

Site content and music by WubbzP. *Wow! Wow! Wubbzy!*, its characters, artwork and fonts, and all other trademarks are the property of their respective owners.
