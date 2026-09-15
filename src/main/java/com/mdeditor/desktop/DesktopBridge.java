package com.mdeditor.desktop;

import javafx.stage.DirectoryChooser;
import javafx.stage.FileChooser;
import javafx.stage.Stage;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

/**
 * Exposed to the web app as `window.desktopBridge` (see App.java). JavaFX's
 * WebView has no File System Access API, so this gives the same open/save/
 * open-folder functionality using native dialogs and direct file I/O.
 */
public class DesktopBridge {
    private final Stage stage;

    public DesktopBridge(Stage stage) {
        this.stage = stage;
    }

    public String openFileDialog() {
        FileChooser chooser = new FileChooser();
        chooser.setTitle("Open Markdown File");
        chooser.getExtensionFilters().add(
                new FileChooser.ExtensionFilter("Markdown", "*.md", "*.markdown", "*.txt"));
        File file = chooser.showOpenDialog(stage);
        return file == null ? null : file.getAbsolutePath();
    }

    public String openFolderDialog() {
        DirectoryChooser chooser = new DirectoryChooser();
        chooser.setTitle("Open Folder");
        File dir = chooser.showDialog(stage);
        return dir == null ? null : dir.getAbsolutePath();
    }

    public String saveFileDialog(String suggestedName) {
        FileChooser chooser = new FileChooser();
        chooser.setTitle("Save Markdown File");
        chooser.setInitialFileName(suggestedName);
        chooser.getExtensionFilters().add(new FileChooser.ExtensionFilter("Markdown", "*.md"));
        File file = chooser.showSaveDialog(stage);
        return file == null ? null : file.getAbsolutePath();
    }

    public String readFile(String path) {
        try {
            return Files.readString(Path.of(path), StandardCharsets.UTF_8);
        } catch (IOException e) {
            return null;
        }
    }

    public boolean writeFile(String path, String content) {
        try {
            Files.writeString(Path.of(path), content, StandardCharsets.UTF_8);
            return true;
        } catch (IOException e) {
            return false;
        }
    }

    /** Returns a JSON string: {name, kind:"directory", path, children:[...]} of markdown files under rootPath. */
    public String listMarkdownFiles(String rootPath) {
        try {
            TreeNode root = buildTree(Path.of(rootPath));
            StringBuilder sb = new StringBuilder();
            writeJson(root, sb);
            return sb.toString();
        } catch (IOException e) {
            return "{\"name\":\"\",\"kind\":\"directory\",\"path\":\"\",\"children\":[]}";
        }
    }

    private TreeNode buildTree(Path dir) throws IOException {
        String name = dir.getFileName() == null ? dir.toString() : dir.getFileName().toString();
        TreeNode node = new TreeNode(name, "directory", dir.toString());
        try (Stream<Path> entries = Files.list(dir)) {
            List<Path> sorted = entries
                    .filter(p -> !p.getFileName().toString().startsWith("."))
                    .sorted()
                    .toList();
            for (Path p : sorted) {
                if (Files.isDirectory(p)) {
                    TreeNode child = buildTree(p);
                    if (!child.children.isEmpty()) node.children.add(child);
                } else if (p.getFileName().toString().matches("(?i).*\\.(md|markdown)$")) {
                    node.children.add(new TreeNode(p.getFileName().toString(), "file", p.toString()));
                }
            }
        }
        return node;
    }

    private static class TreeNode {
        final String name;
        final String kind;
        final String path;
        final List<TreeNode> children = new ArrayList<>();

        TreeNode(String name, String kind, String path) {
            this.name = name;
            this.kind = kind;
            this.path = path;
        }
    }

    private void writeJson(TreeNode node, StringBuilder sb) {
        sb.append('{');
        sb.append("\"name\":").append(quote(node.name)).append(',');
        sb.append("\"kind\":").append(quote(node.kind)).append(',');
        sb.append("\"path\":").append(quote(node.path));
        if ("directory".equals(node.kind)) {
            sb.append(",\"children\":[");
            for (int i = 0; i < node.children.size(); i++) {
                if (i > 0) sb.append(',');
                writeJson(node.children.get(i), sb);
            }
            sb.append(']');
        }
        sb.append('}');
    }

    private String quote(String s) {
        return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
    }
}
