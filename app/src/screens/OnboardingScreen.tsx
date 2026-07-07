import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { api, type UserSettings } from "../api";
import { colors } from "../theme";

type Step = "welcome" | "modules" | "autonomy" | "persona" | "done";

const VOICES: Array<{ id: string; label: string; hint: string }> = [
  { id: "shimmer", label: "Shimmer", hint: "Female · bright and upbeat" },
  { id: "coral", label: "Coral", hint: "Female · calm and warm" },
  { id: "echo", label: "Echo", hint: "Male · friendly and easygoing" },
  { id: "ash", label: "Ash", hint: "Male · deep and steady" },
];

interface Props {
  onComplete: () => void;
}

export function OnboardingScreen({ onComplete }: Props) {
  const [step, setStep] = useState<Step>("welcome");
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [autonomy, setAutonomy] =
    useState<UserSettings["autonomy"]>("suggest");
  const [personaName, setPersonaName] = useState("Alex");
  const [voice, setVoice] = useState("shimmer");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finish = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.saveSettings({
        userId: api.userId,
        autonomy,
        fullAutoContacts: [],
        voiceEnabled,
      });
      if (voiceEnabled) {
        await api.savePersona({
          name: personaName,
          voice,
          greeting: `Hi, this is ${personaName}. I can take a message or help you schedule something.`,
          instructions: "",
        });
      }
      setStep("done");
      onComplete();
    } catch (e) {
      setError(`Could not save settings: ${String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {step === "welcome" && (
        <View>
          <Text style={styles.h1}>Welcome to Envoy</Text>
          <Text style={styles.p}>
            Your AI secretary reads incoming texts, drafts replies in your
            style, and schedules events for you. You stay in control with
            approval levels you choose.
          </Text>
          <Pressable style={styles.cta} onPress={() => setStep("modules")}>
            <Text style={styles.ctaText}>Get started</Text>
          </Pressable>
        </View>
      )}

      {step === "modules" && (
        <View>
          <Text style={styles.h1}>Choose your modules</Text>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Text Secretary</Text>
            <Text style={styles.p}>
              Triage, style-matched replies, and calendar automation. Always
              included.
            </Text>
          </View>
          <View style={[styles.card, styles.rowCard]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Voice Receptionist</Text>
              <Text style={styles.p}>
                Optional: an AI persona answers forwarded calls and takes
                messages. You can enable this later in Settings.
              </Text>
            </View>
            <Switch
              value={voiceEnabled}
              onValueChange={setVoiceEnabled}
              trackColor={{ true: colors.accent }}
            />
          </View>
          <Pressable style={styles.cta} onPress={() => setStep("autonomy")}>
            <Text style={styles.ctaText}>Next</Text>
          </Pressable>
        </View>
      )}

      {step === "autonomy" && (
        <View>
          <Text style={styles.h1}>How autonomous should Envoy be?</Text>
          {(
            [
              ["suggest", "Suggest", "You approve every reply and event."],
              [
                "auto_review",
                "Auto with review window",
                "Sends after a short delay unless you cancel.",
              ],
              [
                "full_auto",
                "Full auto",
                "Acts automatically for contacts you allowlist.",
              ],
            ] as const
          ).map(([value, label, hint]) => (
            <Pressable
              key={value}
              style={[styles.card, autonomy === value && styles.cardActive]}
              onPress={() => setAutonomy(value)}
            >
              <Text style={styles.cardTitle}>{label}</Text>
              <Text style={styles.p}>{hint}</Text>
            </Pressable>
          ))}
          <Pressable
            style={styles.cta}
            onPress={() => setStep(voiceEnabled ? "persona" : "done")}
          >
            <Text style={styles.ctaText}>Next</Text>
          </Pressable>
        </View>
      )}

      {step === "persona" && (
        <View>
          <Text style={styles.h1}>Name your receptionist</Text>
          <Text style={styles.p}>
            Callers will hear this persona when your AI answers a forwarded
            call.
          </Text>
          <TextInput
            style={styles.input}
            value={personaName}
            onChangeText={setPersonaName}
            placeholder="Persona name"
            placeholderTextColor={colors.textDim}
          />
          <Text style={styles.p}>Pick a voice:</Text>
          {VOICES.map((v) => (
            <Pressable
              key={v.id}
              style={[styles.card, voice === v.id && styles.cardActive]}
              onPress={() => setVoice(v.id)}
            >
              <Text style={styles.cardTitle}>{v.label}</Text>
              <Text style={styles.p}>{v.hint}</Text>
            </Pressable>
          ))}
          <Pressable style={styles.cta} onPress={() => setStep("done")}>
            <Text style={styles.ctaText}>Next</Text>
          </Pressable>
        </View>
      )}

      {step === "done" && (
        <View>
          <Text style={styles.h1}>You're all set</Text>
          <Text style={styles.p}>
            Envoy will start triaging incoming texts. Review drafts in the
            Approvals tab.
          </Text>
          <Pressable style={styles.cta} disabled={saving} onPress={() => void finish()}>
            <Text style={styles.ctaText}>{saving ? "Saving…" : "Finish"}</Text>
          </Pressable>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingTop: 40 },
  h1: { color: colors.text, fontSize: 24, fontWeight: "700", marginBottom: 12 },
  p: { color: colors.textDim, fontSize: 15, lineHeight: 21, marginBottom: 8 },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginVertical: 6,
  },
  cardActive: { borderColor: colors.accent },
  rowCard: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardTitle: { color: colors.text, fontWeight: "600", marginBottom: 4 },
  input: {
    color: colors.text,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginVertical: 12,
  },
  cta: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 16,
  },
  ctaText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  error: { color: colors.danger, marginTop: 12, textAlign: "center" },
});
