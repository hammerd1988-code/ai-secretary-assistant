import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api, type InboundMessage } from "../api";
import { colors } from "../theme";

export function InboxScreen() {
  const [messages, setMessages] = useState<InboundMessage[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setMessages(await api.listMessages());
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <FlatList
      style={styles.list}
      data={messages}
      keyExtractor={(m) => m.id}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void load()} />
      }
      ListEmptyComponent={
        <Text style={styles.empty}>
          No messages yet. Incoming texts appear here after triage.
        </Text>
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.from}>{item.contactName ?? item.from}</Text>
          <Text style={styles.body}>{item.body}</Text>
          <Text style={styles.time}>
            {new Date(item.receivedAt).toLocaleString()}
          </Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.bg },
  empty: { color: colors.textDim, textAlign: "center", marginTop: 48, padding: 16 },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    marginHorizontal: 12,
    marginVertical: 6,
  },
  from: { color: colors.accentBlue, fontWeight: "600", marginBottom: 4 },
  body: { color: colors.text, fontSize: 15 },
  time: { color: colors.textDim, fontSize: 12, marginTop: 6 },
});
