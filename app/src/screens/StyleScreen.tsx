import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from "react-native";
import { api } from "../api";
import { colors } from "../theme";

/**
 * Style training + demo simulator.
 * - Paste past replies (one per line) to build a style profile.
 * - Simulate an inbound text to exercise the full pipeline end-to-end.
 * On Android, the SMS module will feed real sent-message history instead.
 */
export function StyleScreen() {
  const [history, setHistory] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [simFrom, setSimFrom] = useState("+15551234567");
  const [simBody, setSimBody] = useState(
    "Hey! Want to grab lunch tomorrow at noon?",
  );

  const ingest = async () => {
    const replies = history
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((reply) => ({ reply }));
    if (replies.length === 0) {
      setStatus("Paste at least one past reply first.");
      return;
    }
    setStatus("Building style profile…");
    try {
      await api.ingestStyle(replies);
      setStatus(`Style profile built from ${replies.length} messages.`);
    } catch (e) {
      setStatus(`Failed: ${String(e)}`);
    }
  };

  const simulate = async () => {
    setStatus("Running pipeline…");
    try {
      await api.simulateInbound(simFrom, simBody);
      setStatus("Done — check Inbox and Approvals.");
    } catch (e) {
      setStatus(`Failed: ${String(e)}`);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.section}>Train your style</Text>
      <Text style={styles.hint}>
        Paste some of your past text replies (one per line). Envoy learns your
        tone, length, and habits so drafts sound like you.
      </Text>
      <TextInput
        style={[styles.input, styles.tall]}
        multiline
        value={history}
        onChangeText={setHistory}
        placeholder={"sounds good, see you then!\nrunning 10 late\nlol yeah"}
        placeholderTextColor={colors.textDim}
      />
      <Pressable style={styles.cta} onPress={() => void ingest()}>
        <Text style={styles.ctaText}>Build style profile</Text>
      </Pressable>

      <Text style={styles.section}>Simulate an incoming text</Text>
      <Text style={styles.hint}>
        Test the full pipeline without SMS access: triage → event extraction →
        styled draft reply.
      </Text>
      <TextInput
        style={styles.input}
        value={simFrom}
        onChangeText={setSimFrom}
        placeholder="From number"
        placeholderTextColor={colors.textDim}
      />
      <TextInput
        style={[styles.input, styles.tall]}
        multiline
        value={simBody}
        onChangeText={setSimBody}
        placeholder="Message body"
        placeholderTextColor={colors.textDim}
      />
      <Pressable style={styles.cta} onPress={() => void simulate()}>
        <Text style={styles.ctaText}>Send test message</Text>
      </Pressable>

      {status ? <Text style={styles.status}>{status}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 40 },
  section: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 18,
    marginBottom: 6,
  },
  hint: { color: colors.textDim, fontSize: 13, marginBottom: 8 },
  input: {
    color: colors.text,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginVertical: 6,
  },
  tall: { minHeight: 90, textAlignVertical: "top" },
  cta: {
    backgroundColor: colors.accentBlue,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  ctaText: { color: "#fff", fontWeight: "700" },
  status: { color: colors.accent, marginTop: 14, textAlign: "center" },
});
