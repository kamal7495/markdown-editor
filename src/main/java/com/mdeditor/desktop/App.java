package com.mdeditor.desktop;

import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.SimpleFileServer;
import javafx.application.Application;
import javafx.application.Platform;
import javafx.scene.Scene;
import javafx.scene.web.WebView;
import javafx.stage.Stage;

import java.net.InetSocketAddress;
import java.nio.file.Path;

/**
 * Desktop shell for the markdown editor web app. Serves the project's own
 * static files (index.html, css/, js/) from disk over a local-only HTTP
 * server, then displays them in a JavaFX WebView. Loading over http://
 * (rather than file://) is required for the app's ES module imports to work.
 */
public class App extends Application {

    private HttpServer server;

    @Override
    public void start(Stage stage) throws Exception {
        Path webRoot = Path.of(System.getProperty("user.dir"));

        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", SimpleFileServer.createFileHandler(webRoot));
        server.setExecutor(null);
        server.start();
        int port = server.getAddress().getPort();

        WebView webView = new WebView();
        webView.getEngine().load("http://127.0.0.1:" + port + "/index.html");

        stage.setTitle("MD Editor");
        stage.setScene(new Scene(webView, 1280, 860));
        stage.setOnCloseRequest(e -> stopServer());
        stage.show();
    }

    @Override
    public void stop() {
        stopServer();
    }

    private void stopServer() {
        if (server != null) {
            server.stop(0);
        }
        Platform.exit();
    }

    public static void main(String[] args) {
        launch(args);
    }
}
