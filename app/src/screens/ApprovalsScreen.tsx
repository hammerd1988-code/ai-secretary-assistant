import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { api, type CalendarEvent, type DraftReply } from "../api";
import { colors } from "../theme";

export function ApprovalsScreen() {
  const [drafts, setDrafts] = useState<DraftReply[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [d, e] = await Promise.all([api.listDrafts(), api.listEvents()]);
      setDrafts(d.filter((x) => x.status === "pending"));
      setEvents(e.filter((x) => x.status === "proposed"));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (fn: () => Promise<unknown>) => {
    await fn();
    await load();
  };

  return (
    <FlatList
      style={styles.list}
      data={[...events.map((e) => ({ type: "event" as const, e })), ...drafts.map((d) => ({ type: "draft" as const, d }))]}
      keyExtractor={(item) => (item.type === "event" ? item.e.id : item.d.id)}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void load()} />
      }
      ListEmptyComponent={
        <Text style={styles.empty}>Nothing awaiting approval.</Text>
      }
      renderItem={({ item }) =>
        item.type === "event" ? (
          <View style={styles.card}>
            <Text style={styles.label}>PROPOSED EVENT</Text>
            <Text style={styles.title}>{item.e.title}</Text>
            <Text style={styles.meta}>
              {new Date(item.e.startsAt).toLocaleString()}
              {item.e.location ? ` · ${item.e.location}` : ""}
            </Text>
            <View style={styles.row}>
              <Pressable
                style={[styles.btn, styles.btnOk]}
                onPress={() => void act(() => api.confirmEvent(item.e.id))}
              >
                <Text style={styles.btnText}>Add to calendar</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, styles.btnNo]}
                onPress={() => void act(() => api.cancelEvent(item.e.id))}
              >
                <Text style={styles.btnText}>Dismiss</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.label}>DRAFT REPLY</Text>
            <TextInput
              style={styles.input}
              multiline
              value={editing[item.d.id] ?? item.d.body}
              onChangeText={(t) =>
                setEditing((prev) => ({ ...prev, [item.d.id]: t }))
              }
            />
            <View style={styles.row}>
              <Pressable
                style={[styles.btn, styles.btnOk]}
                onPress={() =>
                  void act(() =>
                    editing[item.d.id] && editing[item.d.id] !== item.d.body
                      ? api.actOnDraft(item.d.id, "edit", editing[item.d.id])
                      : api.actOnDraft(item.d.id, "approve"),
                  )
                }
              >
                <Text style={styles.btnText}>Send</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, styles.btnNo]}
                onPress={() => void act(() => api.actOnDraft(item.d.id, "dismiss"))}
              >
                <Text style={styles.btnText}>Dismiss</Text>
              </Pressable>
            </View>
          </View>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.bg },
  empty: { color: colors.textDim, textAlign: "center", marginTop: 48 },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    marginHorizontal: 12,
    marginVertical: 6,
  },
  label: { color: colors.warn, fontSize: 11, fontWeight: "700", marginBottom: 6 },
  title: { color: colors.text, fontSize: 16, fontWeight: "600" },
  meta: { color: colors.textDim, marginTop: 4 },
  input: {
    color: colors.text,
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    minHeight: 60,
    textAlignVertical: "top",
  },
  row: { flexDirection: "row", gap: 10, marginTop: 10 },
  btn: { flex: 1, borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  btnOk: { backgroundColor: colors.accent },
  btnNo: { backgroundColor: colors.border },
  btnText: { color: "#fff", fontWeight: "600" },
});
