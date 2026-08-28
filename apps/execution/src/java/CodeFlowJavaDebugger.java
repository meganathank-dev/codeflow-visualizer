import com.sun.jdi.AbsentInformationException;
import com.sun.jdi.ArrayReference;
import com.sun.jdi.BooleanValue;
import com.sun.jdi.Bootstrap;
import com.sun.jdi.ByteValue;
import com.sun.jdi.CharValue;
import com.sun.jdi.DoubleValue;
import com.sun.jdi.FloatValue;
import com.sun.jdi.Field;
import com.sun.jdi.IntegerValue;
import com.sun.jdi.LocalVariable;
import com.sun.jdi.LongValue;
import com.sun.jdi.Method;
import com.sun.jdi.ObjectReference;
import com.sun.jdi.ShortValue;
import com.sun.jdi.StackFrame;
import com.sun.jdi.StringReference;
import com.sun.jdi.ThreadReference;
import com.sun.jdi.Value;
import com.sun.jdi.VirtualMachine;
import com.sun.jdi.VMDisconnectedException;
import com.sun.jdi.connect.Connector;
import com.sun.jdi.connect.LaunchingConnector;
import com.sun.jdi.event.ClassPrepareEvent;
import com.sun.jdi.event.Event;
import com.sun.jdi.event.EventSet;
import com.sun.jdi.event.ExceptionEvent;
import com.sun.jdi.event.MethodEntryEvent;
import com.sun.jdi.event.MethodExitEvent;
import com.sun.jdi.event.StepEvent;
import com.sun.jdi.event.VMDeathEvent;
import com.sun.jdi.event.VMDisconnectEvent;
import com.sun.jdi.request.ClassPrepareRequest;
import com.sun.jdi.request.EventRequest;
import com.sun.jdi.request.EventRequestManager;
import com.sun.jdi.request.ExceptionRequest;
import com.sun.jdi.request.MethodEntryRequest;
import com.sun.jdi.request.MethodExitRequest;
import com.sun.jdi.request.StepRequest;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.StringJoiner;

public final class CodeFlowJavaDebugger {
    private static final String ITEM_SEPARATOR = "\u001F";

    private CodeFlowJavaDebugger() {
    }

    private static final class SerializedValue {
        private final String type;
        private final String value;

        private SerializedValue(String type, String value) {
            this.type = type;
            this.value = value;
        }
    }

    public static void main(String[] args) {
        if (args.length != 3) {
            System.err.println(
                "Usage: CodeFlowJavaDebugger <build-directory> <main-class> <encoded-inputs>"
            );
            System.exit(1);
        }

        String buildDirectory = Path.of(args[0])
            .toAbsolutePath()
            .normalize()
            .toString();

        String mainClass = args[1];
        List<String> inputs = decodeInputs(args[2]);

        try {
            runDebugger(buildDirectory, mainClass, inputs);
        } catch (Exception error) {
            emit(
                "TRACER_FAILURE",
                encode(error.getClass().getSimpleName()),
                encode(error.getMessage() == null
                    ? "Unknown Java tracer failure."
                    : error.getMessage())
            );

            System.exit(1);
        }
    }

    private static void runDebugger(
        String buildDirectory,
        String mainClass,
        List<String> inputs
    ) throws Exception {
        LaunchingConnector connector = Bootstrap
            .virtualMachineManager()
            .defaultConnector();

        Map<String, Connector.Argument> arguments =
            connector.defaultArguments();

        Connector.Argument mainArgument =
            arguments.get("main");

        Connector.Argument optionsArgument =
            arguments.get("options");

        Connector.Argument suspendArgument =
            arguments.get("suspend");

        if (mainArgument == null || optionsArgument == null) {
            throw new IllegalStateException(
                "Required JDI launching arguments are unavailable."
            );
        }

        mainArgument.setValue(mainClass);

        optionsArgument.setValue(
            "-cp \"" + buildDirectory + "\""
        );

        if (suspendArgument != null) {
            suspendArgument.setValue("true");
        }

        VirtualMachine virtualMachine =
            connector.launch(arguments);

        Process targetProcess =
            virtualMachine.process();

        if (!inputs.isEmpty()) {
            String inputText = String.join(System.lineSeparator(), inputs)
                + System.lineSeparator();
            targetProcess.getOutputStream().write(
                inputText.getBytes(StandardCharsets.UTF_8)
            );
        }
        targetProcess.getOutputStream().close();

        List<String> standardOutput =
            Collections.synchronizedList(
                new ArrayList<>()
            );

        List<String> standardError =
            Collections.synchronizedList(
                new ArrayList<>()
            );

        Thread outputReader = startReader(
            targetProcess.getInputStream(),
            standardOutput
        );

        Thread errorReader = startReader(
            targetProcess.getErrorStream(),
            standardError
        );

        configureClassPreparation(
            virtualMachine,
            mainClass
        );

        emit("START");

        virtualMachine.resume();

        boolean executionFailed = processEvents(
            virtualMachine,
            mainClass
        );

        targetProcess.waitFor();
        outputReader.join(1000);
        errorReader.join(1000);

        for (String outputLine : standardOutput) {
            emit(
                "OUTPUT",
                encode("stdout"),
                encode(outputLine)
            );
        }

        for (String errorLine : standardError) {
            emit(
                "OUTPUT",
                encode("stderr"),
                encode(errorLine)
            );
        }

        int exitCode = targetProcess.exitValue();

        String status =
            executionFailed || exitCode != 0
                ? "error"
                : "completed";

        emit("END", status);
    }

    private static List<String> decodeInputs(String encodedInputs) {
        List<String> inputs = new ArrayList<>();
        if (encodedInputs == null || encodedInputs.isEmpty()) {
            return inputs;
        }

        for (String encodedInput : encodedInputs.split(",", -1)) {
            inputs.add(new String(
                Base64.getDecoder().decode(encodedInput),
                StandardCharsets.UTF_8
            ));
        }
        return inputs;
    }

    private static void configureClassPreparation(
        VirtualMachine virtualMachine,
        String mainClass
    ) {
        EventRequestManager requestManager =
            virtualMachine.eventRequestManager();

        ClassPrepareRequest request =
            requestManager.createClassPrepareRequest();

        request.addClassFilter(mainClass);
        request.setSuspendPolicy(
            EventRequest.SUSPEND_ALL
        );
        request.enable();
    }

    private static void configureRuntimeRequests(
        VirtualMachine virtualMachine,
        ThreadReference thread,
        String mainClass
    ) {
        EventRequestManager requestManager =
            virtualMachine.eventRequestManager();

        MethodEntryRequest methodEntryRequest =
            requestManager.createMethodEntryRequest();

        methodEntryRequest.addClassFilter(mainClass);
        methodEntryRequest.setSuspendPolicy(
            EventRequest.SUSPEND_ALL
        );
        methodEntryRequest.enable();

        MethodExitRequest methodExitRequest =
            requestManager.createMethodExitRequest();

        methodExitRequest.addClassFilter(mainClass);
        methodExitRequest.setSuspendPolicy(
            EventRequest.SUSPEND_ALL
        );
        methodExitRequest.enable();

        ExceptionRequest exceptionRequest =
            requestManager.createExceptionRequest(
                null,
                true,
                true
            );

        exceptionRequest.addClassFilter(mainClass);
        exceptionRequest.setSuspendPolicy(
            EventRequest.SUSPEND_ALL
        );
        exceptionRequest.enable();

        ExceptionRequest helperExceptionRequest =
            requestManager.createExceptionRequest(
                null,
                false,
                true
            );

        helperExceptionRequest.addClassExclusionFilter(mainClass);
        helperExceptionRequest.setSuspendPolicy(
            EventRequest.SUSPEND_ALL
        );
        helperExceptionRequest.enable();

        StepRequest stepRequest =
            requestManager.createStepRequest(
                thread,
                StepRequest.STEP_LINE,
                StepRequest.STEP_INTO
            );

        stepRequest.addClassFilter(mainClass);
        stepRequest.setSuspendPolicy(
            EventRequest.SUSPEND_ALL
        );
        stepRequest.enable();
    }

    private static boolean processEvents(
        VirtualMachine virtualMachine,
        String mainClass
    ) throws InterruptedException {
        boolean connected = true;
        boolean executionFailed = false;
        boolean runtimeRequestsConfigured = false;

        while (connected) {
            EventSet eventSet;

            try {
                eventSet = virtualMachine
                    .eventQueue()
                    .remove();
            } catch (VMDisconnectedException error) {
                break;
            }

            for (Event event : eventSet) {
                try {
                    if (
                        event instanceof ClassPrepareEvent
                        && !runtimeRequestsConfigured
                    ) {
                        ClassPrepareEvent prepareEvent =
                            (ClassPrepareEvent) event;

                        configureRuntimeRequests(
                            virtualMachine,
                            prepareEvent.thread(),
                            mainClass
                        );

                        runtimeRequestsConfigured = true;
                    } else if (
                        event instanceof MethodEntryEvent
                    ) {
                        handleMethodEntry(
                            (MethodEntryEvent) event
                        );
                    } else if (
                        event instanceof StepEvent
                    ) {
                        handleStep((StepEvent) event);
                    } else if (
                        event instanceof MethodExitEvent
                    ) {
                        handleMethodExit(
                            (MethodExitEvent) event
                        );
                    } else if (
                        event instanceof ExceptionEvent
                    ) {
                        handleException(
                            (ExceptionEvent) event,
                            mainClass
                        );

                        executionFailed = true;
                    } else if (
                        event instanceof VMDeathEvent
                        || event instanceof VMDisconnectEvent
                    ) {
                        connected = false;
                    }
                } catch (Exception error) {
                    executionFailed = true;

                    emit(
                        "ERROR",
                        "1",
                        encode(
                            error.getClass().getSimpleName()
                        ),
                        encode(
                            error.getMessage() == null
                                ? "JDI event handling failure."
                                : error.getMessage()
                        )
                    );
                }
            }

            try {
                eventSet.resume();
            } catch (VMDisconnectedException ignored) {
                connected = false;
            }
        }

        return executionFailed;
    }

    private static void handleMethodEntry(
        MethodEntryEvent event
    ) throws Exception {
        Method method = event.method();

        if (method.name().startsWith("<")) {
            return;
        }

        ThreadReference thread = event.thread();
        StackFrame frame = thread.frame(0);

        String frameId = createFrameId(thread);
        int methodLine = normalizeLine(
            event.location().lineNumber()
        );

        int callerLine = methodLine;

        if (thread.frameCount() > 1) {
            callerLine = normalizeLine(
                thread.frame(1)
                    .location()
                    .lineNumber()
            );
        }

        Map<String, SerializedValue> locals =
            captureLocals(frame);

        emit(
            "METHOD_ENTER",
            frameId,
            Integer.toString(methodLine),
            Integer.toString(callerLine),
            encode(method.name()),
            encodeLocals(locals)
        );
    }

    private static void handleStep(
        StepEvent event
    ) throws Exception {
        ThreadReference thread = event.thread();
        StackFrame frame = thread.frame(0);

        Method method = frame
            .location()
            .method();

        if (method.name().startsWith("<")) {
            return;
        }

        emit(
            "LINE",
            createFrameId(thread),
            Integer.toString(
                normalizeLine(
                    event.location().lineNumber()
                )
            ),
            encode(method.name()),
            encodeLocals(captureLocals(frame))
        );
    }

    private static void handleMethodExit(
        MethodExitEvent event
    ) throws Exception {
        Method method = event.method();

        if (method.name().startsWith("<")) {
            return;
        }

        ThreadReference thread = event.thread();
        StackFrame frame = thread.frame(0);

        SerializedValue returnValue =
            new SerializedValue("null", "");

        if (
            event.virtualMachine()
                .canGetMethodReturnValues()
        ) {
            try {
                returnValue = serializeValue(
                    event.returnValue()
                );
            } catch (
                UnsupportedOperationException ignored
            ) {
                returnValue =
                    new SerializedValue("unknown", "");
            }
        }

        emit(
            "METHOD_EXIT",
            createFrameId(thread),
            Integer.toString(
                normalizeLine(
                    event.location().lineNumber()
                )
            ),
            encode(method.name()),
            encode(returnValue.type),
            encode(returnValue.value),
            encodeLocals(captureLocals(frame))
        );
    }

    private static void handleException(
        ExceptionEvent event,
        String mainClass
    ) {
        ObjectReference exception = event.exception();
        String exceptionType = exception
            .referenceType()
            .name();
        String exceptionMessage = null;
        int line = normalizeLine(event.location().lineNumber());

        for (Field field : exception.referenceType().allFields()) {
            if (!"detailMessage".equals(field.name())) {
                continue;
            }

            Value messageValue = exception.getValue(field);
            if (messageValue instanceof StringReference) {
                exceptionMessage = ((StringReference) messageValue).value();
            }
            break;
        }

        try {
            for (StackFrame frame : event.thread().frames()) {
                if (mainClass.equals(frame.location().declaringType().name())) {
                    line = normalizeLine(frame.location().lineNumber());
                    break;
                }
            }
        } catch (Exception ignored) {
            // Fall back to the exception location when caller frames are unavailable.
        }

        emit(
            "ERROR",
            Integer.toString(line),
            encode(exceptionType),
            encode(
                exceptionMessage == null || exceptionMessage.isBlank()
                    ? "Java exception observed by JDI."
                    : exceptionMessage
            )
        );
    }

    private static String createFrameId(
        ThreadReference thread
    ) throws Exception {
        return (
            thread.uniqueID() +
            "-" +
            thread.frameCount()
        );
    }

    private static int normalizeLine(int line) {
        return line > 0 ? line : 1;
    }

    private static Map<String, SerializedValue>
        captureLocals(StackFrame frame)
        throws Exception {
        Map<String, SerializedValue> locals =
            new LinkedHashMap<>();

        List<LocalVariable> variables;

        try {
            variables = new ArrayList<>(
                frame.visibleVariables()
            );
        } catch (AbsentInformationException error) {
            return locals;
        }

        variables.sort(
            Comparator.comparing(LocalVariable::name)
        );

        Map<LocalVariable, Value> values =
            frame.getValues(variables);

        for (LocalVariable variable : variables) {
            locals.put(
                variable.name(),
                serializeValue(values.get(variable))
            );
        }

        return locals;
    }

    private static SerializedValue serializeValue(
        Value value
    ) {
        if (value == null) {
            return new SerializedValue("null", "");
        }

        if (value instanceof BooleanValue) {
            return new SerializedValue(
                "boolean",
                Boolean.toString(
                    ((BooleanValue) value).value()
                )
            );
        }

        if (value instanceof ByteValue) {
            return new SerializedValue(
                "integer",
                Byte.toString(
                    ((ByteValue) value).value()
                )
            );
        }

        if (value instanceof ShortValue) {
            return new SerializedValue(
                "integer",
                Short.toString(
                    ((ShortValue) value).value()
                )
            );
        }

        if (value instanceof IntegerValue) {
            return new SerializedValue(
                "integer",
                Integer.toString(
                    ((IntegerValue) value).value()
                )
            );
        }

        if (value instanceof LongValue) {
            return new SerializedValue(
                "integer",
                Long.toString(
                    ((LongValue) value).value()
                )
            );
        }

        if (value instanceof FloatValue) {
            return new SerializedValue(
                "number",
                Float.toString(
                    ((FloatValue) value).value()
                )
            );
        }

        if (value instanceof DoubleValue) {
            return new SerializedValue(
                "number",
                Double.toString(
                    ((DoubleValue) value).value()
                )
            );
        }

        if (value instanceof CharValue) {
            return new SerializedValue(
                "string",
                Character.toString(
                    ((CharValue) value).value()
                )
            );
        }

        if (value instanceof StringReference) {
            return new SerializedValue(
                "string",
                ((StringReference) value).value()
            );
        }

        if (value instanceof ArrayReference) {
            return serializeArray(
                (ArrayReference) value
            );
        }

        if (value instanceof ObjectReference) {
            ObjectReference object =
                (ObjectReference) value;

            return new SerializedValue(
                "object",
                object.referenceType().name()
            );
        }

        return new SerializedValue(
            "unknown",
            value.toString()
        );
    }

    private static SerializedValue serializeArray(
        ArrayReference array
    ) {
        String typeName =
            array.referenceType().name();

        boolean numericArray =
            typeName.matches(
                "(byte|short|int|long|float|double)\\[\\]"
            );

        List<String> values = new ArrayList<>();

        for (Value item : array.getValues()) {
            SerializedValue serializedItem =
                serializeValue(item);

            values.add(serializedItem.value);
        }

        if (numericArray) {
            return new SerializedValue(
                "array:number",
                String.join(",", values)
            );
        }

        return new SerializedValue(
            "array:string",
            String.join(ITEM_SEPARATOR, values)
        );
    }

    private static String encodeLocals(
        Map<String, SerializedValue> locals
    ) {
        StringJoiner joiner = new StringJoiner(";");

        for (
            Map.Entry<String, SerializedValue> entry
                : locals.entrySet()
        ) {
            SerializedValue value = entry.getValue();

            joiner.add(
                encode(entry.getKey()) +
                "," +
                encode(value.type) +
                "," +
                encode(value.value)
            );
        }

        return encode(joiner.toString());
    }

    private static Thread startReader(
        InputStream input,
        List<String> destination
    ) {
        Thread readerThread = new Thread(() -> {
            try (
                BufferedReader reader =
                    new BufferedReader(
                        new InputStreamReader(
                            input,
                            StandardCharsets.UTF_8
                        )
                    )
            ) {
                String line;

                while ((line = reader.readLine()) != null) {
                    destination.add(line);
                }
            } catch (IOException error) {
                destination.add(
                    "Stream reader error: " +
                    error.getMessage()
                );
            }
        });

        readerThread.setDaemon(true);
        readerThread.start();

        return readerThread;
    }

    private static String encode(String value) {
        String safeValue =
            value == null ? "" : value;

        return Base64
            .getEncoder()
            .encodeToString(
                safeValue.getBytes(
                    StandardCharsets.UTF_8
                )
            );
    }

    private static void emit(
        String type,
        String... fields
    ) {
        StringBuilder output =
            new StringBuilder(type);

        for (String field : fields) {
            output.append('\t');
            output.append(field == null ? "" : field);
        }

        System.out.println(output);
    }
}
