# How to edit this site

All the words live in three plain text files in the `content` folder. You never need to touch the code.

| File | What it controls |
|---|---|
| `content/site.txt` | Home text, links, tab names, the Ethical Marketing and About tabs, footer, 404 message |
| `content/manifesto.txt` | The whole Ethical Marketing Manifesto page |
| `content/glossary.txt` | The glossary: one term per line, as `Term \| Definition` |

Each file starts with a short note explaining its format.

## Change or add something (in the browser, on GitHub)

1. Open the file in your repository and click the pencil icon.
2. Change the words. To add a glossary term, add a line. Keep the `|` between term and definition, and don't use `|` anywhere else on the line.
3. Click **Commit changes**. The site updates in a minute or two.
4. Made a mistake? Open the file's **History** and restore the earlier version.

Write `TODO` as a value in `site.txt` to hide an item (a link, an image, a block) until it is ready.

## Images

Put new images in the `images` folder (Add file, Upload files). Then write the file name in `site.txt`, for example `philosophy-image: images/my-photo.jpg`. Use small files: about 800 pixels wide, ideally under 150 KB.

## The font

The site uses the Inter Tight font from its own folder (`assets/fonts`), so visitors' browsers don't contact Google. It is free, under the SIL Open Font License (`assets/fonts/OFL.txt`). Nothing to do here.

## Documents

Your resumé is in the `files` folder. To update it, upload a new PDF with the same name, `linda-fairgrieve-resume.pdf`.

## Preview on your own computer (optional)

Browsers block pages that read text files when opened by double-click. Instead, open a terminal in this folder and run `python3 -m http.server 8000`, then visit http://localhost:8000 in your browser.

## What lives where

- `index.html`, `about/`, `ethical-marketing/glossary/`, `ethical-marketing/manifesto/`: the four pages
- `404.html`: the "page not found" page
- `assets/`: the look (`style.css`) and the script that reads the text files (`site.js`)
- `favicon.svg`, `favicon.ico`, `apple-touch-icon.png`: the small icons
- `files/`: downloadable documents (the resumé)
- `CNAME`: created by GitHub when you set the custom domain in Settings, Pages (it is not in the starting folder)
- `robots.txt`, `sitemap.xml`: help search engines
