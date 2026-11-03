import com.sun.tools.attach.VirtualMachine;
import com.sun.tools.attach.VirtualMachineDescriptor;

import java.nio.file.Path;

/** Attaches this jar as an agent to an already-running JVM. Needs a JDK (not a bare JRE). */
public class AttachMain {
    public static void main(String[] a) throws Exception {
        if (a.length < 1) {
            System.out.println("Usage: java -jar swing-crawler-agent.jar <pid> [out=shots,depth=3,delay=5,skip=regex]");
            System.out.println("Running JVMs:");
            for (VirtualMachineDescriptor d : VirtualMachine.list())
                System.out.println("  " + d.id() + "  " + d.displayName());
            return;
        }
        String jar = Path.of(AttachMain.class.getProtectionDomain().getCodeSource().getLocation().toURI()).toString();
        VirtualMachine vm = VirtualMachine.attach(a[0]);
        try {
            vm.loadAgent(jar, a.length > 1 ? a[1] : "");
            System.out.println("Agent loaded into PID " + a[0] + ". Watch the target app's console / output folder.");
        } finally {
            vm.detach();
        }
    }
}
