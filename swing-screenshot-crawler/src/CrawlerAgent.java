import java.awt.Window;
import java.lang.instrument.Instrumentation;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;

/**
 * Java agent entry point. Works both ways:
 *   - at startup:       java -javaagent:swing-crawler-agent.jar=out=shots,depth=3 -jar yourapp.jar   (premain)
 *   - on a running JVM: java -jar swing-crawler-agent.jar <pid> out=shots,depth=3                   (agentmain)
 *
 * Options (comma separated key=value): out, depth, delay, skip
 */
public class CrawlerAgent {

    public static void premain(String args, Instrumentation inst) {
        start(args);
    }

    public static void agentmain(String args, Instrumentation inst) {
        start(args);
    }

    private static void start(String args) {
        Map<String, String> o = parse(args);
        if (o.containsKey("skip")) System.setProperty("crawler.skip", o.get("skip"));
        Path out = Path.of(o.getOrDefault("out", "shots"));
        int depth = Integer.parseInt(o.getOrDefault("depth", "3"));
        int delay = Integer.parseInt(o.getOrDefault("delay", "5"));

        Thread t = new Thread(() -> {
            try {
                waitForWindow();
                Thread.sleep(delay * 1000L); // let the app finish loading
                new ScreenCrawler(out, depth).crawl();
            } catch (Exception e) {
                e.printStackTrace();
            }
        }, "swing-crawler");
        t.setDaemon(true);
        t.start();
    }

    private static void waitForWindow() throws InterruptedException {
        while (true) {
            for (Window w : Window.getWindows()) if (w.isShowing()) return;
            Thread.sleep(500);
        }
    }

    private static Map<String, String> parse(String args) {
        Map<String, String> m = new HashMap<>();
        if (args == null || args.isBlank()) return m;
        for (String kv : args.split(",")) {
            int i = kv.indexOf('=');
            if (i > 0) m.put(kv.substring(0, i).trim(), kv.substring(i + 1).trim());
        }
        return m;
    }
}
