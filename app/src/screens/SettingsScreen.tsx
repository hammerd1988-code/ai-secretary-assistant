import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { api, type UserSettings } from "../api";
import { colors } from "../theme";

const AUTONOMY_OPTIONS: Array<{
  value: UserSettings["autonomy"];
  label: string;
  hint: string;
}> = [
  {
    value: "suggest",
    label: "Suggest",
    hint: "Drafts replies and events; you approve each one.",
  },
  {
    value: "auto_review",
    label: "Auto with review window",
    hint: "Sends after a delay unless you cancel.",
  },
  {
    value: "full_auto",
    label: "Full auto (allowlisted contacts)",
    hint: "Replies and schedules automatically for trusted contacts.",
  },
];

export function SettingsScreen() {
  const [settings, setSettings] = useState<UserSettings | null>(null);

  const load = useCallback(async () => {
    setSettings(await api.getSettings());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const update = async (patch: Partial<UserSettings>) => {
    if (!settings) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    await api.saveSettings(next);
  };

  if (!settings) {
    return (
      <View style={styles.container}>
        <Text style={styles.hint}>Loading…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.section}>Autonomy</Text>
      {AUTONOMY_OPTIONS.map((opt) => (
        <Pressable
          key={opt.value}
          style={[
            styles.option,
            settings.autonomy === opt.value && styles.optionActive,
          ]}
          onPress={() => void update({ autonomy: opt.value })}
        >
          <Text style={styles.optionLabel}>{opt.label}</Text>
          <Text style={styles.hint}>{opt.hint}</Text>
        </Pressable>
      ))}

      <Text style={styles.section}>Voice Receptionist (optional)</Text>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.optionLabel}>AI answers forwarded calls</Text>
          <Text style={styles.hint}>
            Requires setting up conditional call forwarding to your Envoy
            number. Text features work fully without this.
          </Text>
        </View>
        <Switch
          value={settings.voiceEnabled}
          onValueChange={(v) => void update({ voiceEnabled: v })}
          trackColor={{ true: colors.accent }}
        />
      </View>

      {settings.voiceEnabled ? (
        <View style={[styles.row, { marginTop: 8 }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.optionLabel}>I'm busy mode</Text>
            <Text style={styles.hint}>
              Your AI tells callers you're tied up right now, takes down
              anything important, and passes the message along to you.
            </Text>
          </View>
          <Switch
            value={settings.busyMode}
            onValueChange={(v) => void update({ busyMode: v })}
            trackColor={{ true: colors.warn }}
          />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 12 },
  section: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 18,
    marginBottom: 8,
  },
  option: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  optionActive: { borderColor: colors.accent },
  optionLabel: { color: colors.text, fontWeight: "600" },
  hint: { color: colors.textDim, fontSize: 13, marginTop: 4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    gap: 12,
  },
});
