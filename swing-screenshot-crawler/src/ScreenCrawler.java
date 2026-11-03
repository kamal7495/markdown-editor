import javax.imageio.ImageIO;
import javax.swing.*;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.nio.file.*;
import java.util.*;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.regex.Pattern;

/**
 * Starter Swing UI crawler: clicks actionable items, screenshots each window/state,
 * and writes manifest.json (input for docs + visual-regression tooling).
 *
 * Usage (call from a NON-EDT thread, e.g. after your main window is visible):
 *   new Thread(() -> { try { new ScreenCrawler(Path.of("shots"), 3).crawl(); }
 *                      catch (Exception e) { e.printStackTrace(); } }).start();
 */
public class ScreenCrawler {
    // Buttons whose label matches are never clicked. Extend for your app.
    private static final Pattern SKIP = Pattern.compile(System.getProperty("crawler.skip",
            "(?i)delete|remove|exit|quit|log ?out|submit|save|confirm|send|approve|reject|clear|reset"));
    private static final int SETTLE_MS = 600;

    private final Path outDir;
    private final int maxDepth;
    private final Set<String> visited = new HashSet<>();
    private final List<String> manifest = new ArrayList<>();
    private int counter = 0;

    public ScreenCrawler(Path outDir, int maxDepth) {
        this.outDir = outDir;
        this.maxDepth = maxDepth;
    }

    public void crawl() throws Exception {
        Files.createDirectories(outDir);
        for (Window w : onEdt(this::visibleWindows)) {
            explore(w, w.getClass().getSimpleName(), 0);
        }
        Files.writeString(outDir.resolve("manifest.json"),
                "[\n" + String.join(",\n", manifest) + "\n]\n");
        System.out.println("Done. " + counter + " screenshots in " + outDir.toAbsolutePath());
    }

    private void explore(Window w, String path, int depth) throws Exception {
        capture(w, path);
        if (depth >= maxDepth) return;

        List<JTabbedPane> panes = onEdt(() -> find(w, JTabbedPane.class));
        if (panes.isEmpty()) {
            clickAll(w, path, depth);
            return;
        }
        // Select each tab in turn, capture it, and click what is visible in that state.
        for (JTabbedPane tp : panes) {
            int original = onEdt(tp::getSelectedIndex);
            int n = onEdt(tp::getTabCount);
            for (int i = 0; i < n; i++) {
                final int idx = i;
                String title = onEdt(() -> tp.getTitleAt(idx));
                if (!visited.add(path + "|tab|" + title)) continue;
                String tabPath = path + " > tab:" + title;
                SwingUtilities.invokeLater(() -> tp.setSelectedIndex(idx));
                Thread.sleep(SETTLE_MS);
                capture(w, tabPath);
                clickAll(w, tabPath, depth);
            }
            SwingUtilities.invokeLater(() -> tp.setSelectedIndex(original));
            Thread.sleep(SETTLE_MS);
        }
    }

    /** Clicks every visible actionable item in the window's current state. */
    private void clickAll(Window w, String path, int depth) throws Exception {
        for (AbstractButton b : onEdt(() -> clickables(w))) {
            if (!onEdt(w::isShowing)) return; // window was closed by an earlier click
            String label = onEdt(() -> labelOf(b));
            String key = path + "|btn|" + label;
            if (SKIP.matcher(label).find() || !visited.add(key)) continue;

            Set<Window> before = new HashSet<>(onEdt(this::visibleWindows));
            // invokeLater, NOT invokeAndWait: a modal dialog would block invokeAndWait forever.
            SwingUtilities.invokeLater(b::doClick);
            Thread.sleep(SETTLE_MS);

            List<Window> opened = new ArrayList<>(onEdt(this::visibleWindows));
            opened.removeAll(before);
            String next = path + " > " + label;
            if (opened.isEmpty()) {
                if (onEdt(w::isShowing)) capture(w, next); // in-place state change
            } else {
                for (Window nw : opened) {
                    explore(nw, next, depth + 1);
                    SwingUtilities.invokeLater(nw::dispose);
                    Thread.sleep(300);
                }
            }
        }
    }

    // ---- helpers -------------------------------------------------------

    private List<Window> visibleWindows() {
        List<Window> out = new ArrayList<>();
        for (Window w : Window.getWindows()) if (w.isShowing()) out.add(w);
        return out;
    }

    private List<AbstractButton> clickables(Container root) {
        List<AbstractButton> out = new ArrayList<>();
        collect(root, out);
        return out;
    }

    private void collect(Component c, List<AbstractButton> out) {
        if (c instanceof JMenu m) {                       // open submenus, don't click the menu itself
            for (Component mc : m.getMenuComponents()) collect(mc, out);
            return;
        }
        if (c instanceof AbstractButton b && b.isEnabled()
                && (b.isShowing() || b instanceof JMenuItem)
                && !(b instanceof JCheckBox) && !(b instanceof JRadioButton)
                && !(b instanceof JToggleButton)) {       // skip toggles: they change app state
            out.add(b);
        }
        if (c instanceof JMenuBar mb) {
            for (int i = 0; i < mb.getMenuCount(); i++) collect(mb.getMenu(i), out);
        }
        if (c instanceof Container ct) for (Component ch : ct.getComponents()) collect(ch, out);
        if (c instanceof RootPaneContainer rpc && c != rpc.getContentPane()) {
            JMenuBar mb = ((JRootPane) ((RootPaneContainer) c).getRootPane()).getJMenuBar();
            if (mb != null) collect(mb, out);
        }
    }

    private <T extends Component> List<T> find(Container root, Class<T> type) {
        List<T> out = new ArrayList<>();
        for (Component c : root.getComponents()) {
            if (type.isInstance(c)) out.add(type.cast(c));
            if (c instanceof Container ct) out.addAll(find(ct, type));
        }
        return out;
    }

    private String labelOf(AbstractButton b) {
        if (b.getText() != null && !b.getText().isBlank()) return b.getText().trim();
        if (b.getName() != null) return b.getName();
        if (b.getToolTipText() != null) return b.getToolTipText();
        return b.getClass().getSimpleName();
    }

    private void capture(Window w, String path) throws Exception {
        BufferedImage img = onEdt(() -> {
            BufferedImage bi = new BufferedImage(Math.max(1, w.getWidth()),
                    Math.max(1, w.getHeight()), BufferedImage.TYPE_INT_ARGB);
            Graphics2D g = bi.createGraphics();
            w.paint(g);
            g.dispose();
            return bi;
        });
        String id = String.format("screen-%03d", ++counter);
        ImageIO.write(img, "png", outDir.resolve(id + ".png").toFile());
        String title = onEdt(() -> w instanceof Frame f ? f.getTitle()
                : w instanceof Dialog d ? d.getTitle() : "");
        manifest.add(String.format("  {\"id\":\"%s\",\"title\":\"%s\",\"path\":\"%s\",\"file\":\"%s.png\"}",
                id, esc(title), esc(path), id));
    }

    private static String esc(String s) {
        return s == null ? "" : s.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private static <T> T onEdt(Callable<T> task) throws Exception {
        if (SwingUtilities.isEventDispatchThread()) return task.call();
        Object[] box = new Object[2];
        SwingUtilities.invokeAndWait(() -> {
            try { box[0] = task.call(); } catch (Exception e) { box[1] = e; }
        });
        if (box[1] != null) throw (Exception) box[1];
        @SuppressWarnings("unchecked") T r = (T) box[0];
        return r;
    }
}
