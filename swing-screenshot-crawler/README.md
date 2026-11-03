# swing-screenshot-crawler

Automatically explores a Java Swing application: it selects every tab, clicks every button and menu item, follows the dialogs they open, and saves a PNG of each window/state plus a `manifest.json` describing the navigation path to every screenshot.

Use the output for **documentation** (auto-generated user guides) and **testing** (visual regression against a baseline).

Requires **JDK 17+**. No third-party dependencies.

```
src/ScreenCrawler.java   the crawler (can be used on its own)
src/CrawlerAgent.java    Java agent entry point (premain + agentmain)
src/AttachMain.java      CLI to attach the agent to an already-running JVM
demo/DemoApp.java        tiny Swing app to try it on
build.sh                 builds swing-crawler-agent.jar
```

## Build

```bash
./build.sh        # produces swing-crawler-agent.jar
```

## Option A - Attach as a Java agent at startup (no code changes)

Add one JVM flag to however you launch your app:

```bash
java -javaagent:/path/to/swing-crawler-agent.jar=out=shots,depth=3,delay=10 -jar yourapp.jar
```

The agent waits for the first window to appear, waits `delay` seconds for the app to finish loading, then starts crawling in a background thread.

Where to put the flag:

| Launch method | Where |
|---|---|
| Shell/batch script | after `java`, before `-jar` / the main class |
| IntelliJ / Eclipse | Run configuration -> VM options |
| Maven / Gradle run | `JAVA_TOOL_OPTIONS="-javaagent:..."` environment variable |
| Launcher you can't edit | `JAVA_TOOL_OPTIONS` environment variable (applies to every JVM started in that shell) |

## Option B - Attach to an already-running app (no restart)

```bash
java -jar swing-crawler-agent.jar                       # lists running JVMs and their PIDs
java -jar swing-crawler-agent.jar <pid> out=shots,depth=3,delay=0
```

Notes:
- Run it with a **JDK** (the attach API is not in a bare JRE), as the **same OS user** that started the app.
- If attach is refused, the usual causes are a different OS user, a different JDK major version, or a locked-down launcher (`-XX:+DisableAttachMechanism`). Option A or C works in those cases.

## Option C - Call it from inside your app

Copy `src/ScreenCrawler.java` into your project (add a `package` line if you like) and trigger it from anywhere after your main window is visible, e.g. behind a debug flag or a hidden menu item:

```java
// A) behind a system property:  java -Dui.crawl=true -jar yourapp.jar
if (Boolean.getBoolean("ui.crawl")) {
    new Thread(() -> {
        try {
            Thread.sleep(5000);                                   // let the UI settle
            new ScreenCrawler(java.nio.file.Path.of("shots"), 3).crawl();
        } catch (Exception e) { e.printStackTrace(); }
    }, "ui-crawler").start();
}

// B) hidden menu item (e.g. in a Help/Debug menu)
JMenuItem crawl = new JMenuItem("Capture all screens");
crawl.addActionListener(e -> new Thread(() -> {
    try { new ScreenCrawler(java.nio.file.Path.of("shots"), 3).crawl(); }
    catch (Exception ex) { ex.printStackTrace(); }
}).start());
debugMenu.add(crawl);
```

**Always call `crawl()` from a background thread, never the Event Dispatch Thread.** It blocks while it waits for screens to settle.

## Options (agent arguments)

| Option | Default | Meaning |
|---|---|---|
| `out` | `shots` | output folder for PNGs + `manifest.json` |
| `depth` | `3` | how many levels of dialogs-opening-dialogs to follow |
| `delay` | `5` | seconds to wait after the first window appears |
| `skip` | see below | regex (case-insensitive flag included) of button labels to never click |

Default skip list: `delete|remove|exit|quit|log ?out|submit|save|confirm|send|approve|reject|clear|reset`.
Override it with the `skip` option, or `-Dcrawler.skip=...` when using Option C. Because agent arguments are comma-separated, write the regex with `|` and no commas, e.g. `skip=(?i)delete|exit|post trade`.

## Output

```
shots/screen-001.png
shots/screen-002.png
shots/manifest.json
```

```json
{"id":"screen-003","title":"Settings","path":"JFrame > tab:Home > Settings","file":"screen-003.png"}
```

## Safety - read before pointing it at a real system

The crawler **really clicks things**. Run it against a **test/UAT environment with test data**, never production. Extend the skip list for anything destructive or irreversible in your app (booking, approving, sending, posting, deleting). Toggles and checkboxes are skipped on purpose because they change application state.

## Known limitations

- Only standard Swing buttons, menu items and tabs are clicked. Custom-painted components, table cells, tree nodes and right-click menus are not (yet).
- A menu item that is reachable from several tab states can be captured more than once.
- Screenshots use `Window.paint()`, so they show Swing content but not native OS dialogs (e.g. native file choosers).
- Dynamic content (clocks, live data) will differ between runs; mask it when doing pixel diffs.

## Roadmap

1. `manifest.json` -> Markdown user guide generator.
2. Baseline + diff tool for visual regression (pixel diff with masks, manifest diff).
3. Table rows, tree nodes, popup menus.
4. CI job that runs the crawl on every build.

## Try it on the demo app

```bash
javac -d /tmp/demo demo/DemoApp.java
java -javaagent:swing-crawler-agent.jar=out=shots,depth=3,delay=2 -cp /tmp/demo DemoApp
```
