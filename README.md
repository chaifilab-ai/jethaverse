# JethaVerse

Find any Taarak Mehta episode. Formerly "Jethiya" and "Gokuldham Guide".

An unofficial fan guide to *Taarak Mehta Ka Ooltah Chashmah*: all 4,872 episodes SonyLIV lists, with a free link for 4,820 of them, plus the episodes aired since. It keeps itself current: new uploads are added and dead links replaced by a daily job (`docs/OPERATIONS.md`, "Staying current").

- Type a name or a story ("Jethalal Goli", "garba", "bomb scare", a Hindi name) and see every episode that matches.
- Or light up the windows in Gokuldham Society: each window is a character, and it types the name for you.
- Mark episodes Watched or Saved, or hit the dice and let Jethalal pick one.

```
python tools/serve.py      # then open http://localhost:5317
npm test                   # 34 search, data and live-update tests
npm run test:py            # name-matching tests and the automation's rules
npm run update             # look for new uploads and check links now
```

You can also double-click `index.html`. Everything works except nothing plays inside the page: "Watch" opens YouTube.

**More docs:**
- `docs/SPEC.md`: what it does.
- `docs/OPERATIONS.md`: how it is built, how to change it and how the data was gathered.
- `docs/QA.md`: what was tested.
- `CHANGELOG.md`: release history.
- `archive/v1-finder/`: the previous screen (Episodes 1-50 only), kept in case you want it back.
