import javax.swing.*;
import java.awt.*;

/** Tiny Swing app to try the crawler on. */
public class DemoApp {
    public static void main(String[] args) {
        SwingUtilities.invokeLater(() -> {
            JFrame f = new JFrame("Demo App");
            JMenuBar mb = new JMenuBar();
            JMenu file = new JMenu("File");
            JMenuItem about = new JMenuItem("About");
            about.addActionListener(e -> JOptionPane.showMessageDialog(f, "Demo App v1"));
            file.add(about);
            file.add(new JMenuItem("Exit")); // skipped by the default skip list
            mb.add(file);
            f.setJMenuBar(mb);

            JTabbedPane tabs = new JTabbedPane();
            JPanel home = new JPanel();
            JButton settings = new JButton("Settings");
            settings.addActionListener(e -> {
                JDialog d = new JDialog(f, "Settings", true); // modal on purpose
                d.add(new JLabel("Settings dialog", SwingConstants.CENTER));
                d.setSize(260, 140);
                d.setLocationRelativeTo(f);
                d.setVisible(true);
            });
            home.add(settings);
            home.add(new JButton("Delete everything")); // skipped
            tabs.addTab("Home", home);
            tabs.addTab("Reports", new JLabel("Reports go here", SwingConstants.CENTER));
            f.add(tabs, BorderLayout.CENTER);
            f.setSize(480, 320);
            f.setDefaultCloseOperation(WindowConstants.EXIT_ON_CLOSE);
            f.setVisible(true);
        });
    }
}
