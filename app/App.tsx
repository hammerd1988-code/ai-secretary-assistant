import { useEffect, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { InboxScreen } from "./src/screens/InboxScreen";
import { ApprovalsScreen } from "./src/screens/ApprovalsScreen";
import { CallsScreen } from "./src/screens/CallsScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { OnboardingScreen } from "./src/screens/OnboardingScreen";
import { StyleScreen } from "./src/screens/StyleScreen";
import { startInboundListener } from "./src/sms";
import { colors } from "./src/theme";

type Tab = "inbox" | "approvals" | "style" | "calls" | "settings";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "inbox", label: "Inbox" },
  { key: "approvals", label: "Approvals" },
  { key: "style", label: "Style" },
  { key: "calls", label: "Calls" },
  { key: "settings", label: "Settings" },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("inbox");
  const [onboarded, setOnboarded] = useState(false);

  useEffect(() => startInboundListener(), []);

  if (!onboarded) {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
        <OnboardingScreen onComplete={() => setOnboarded(true)} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
      <View style={styles.header}>
        <Text style={styles.title}>Envoy</Text>
        <Text style={styles.subtitle}>your AI secretary</Text>
      </View>
      <View style={styles.body}>
        {tab === "inbox" && <InboxScreen />}
        {tab === "approvals" && <ApprovalsScreen />}
        {tab === "style" && <StyleScreen />}
        {tab === "calls" && <CallsScreen />}
        {tab === "settings" && <SettingsScreen />}
      </View>
      <View style={styles.tabbar}>
        {TABS.map((t) => (
          <Pressable
            key={t.key}
            style={styles.tab}
            onPress={() => setTab(t.key)}
          >
            <Text
              style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}
            >
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { color: colors.text, fontSize: 20, fontWeight: "700" },
  subtitle: { color: colors.textDim, fontSize: 13 },
  body: { flex: 1 },
  tabbar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  tab: { flex: 1, alignItems: "center", paddingVertical: 12 },
  tabLabel: { color: colors.textDim, fontSize: 13 },
  tabLabelActive: { color: colors.accent, fontWeight: "700" },
});
