import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api, type CallSummary } from "../api";
import { colors } from "../theme";

const urgencyColor: Record<CallSummary["urgency"], string> = {
  low: colors.textDim,
  medium: colors.warn,
  high: colors.danger,
};

export function CallsScreen() {
  const [calls, setCalls] = useState<CallSummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setCalls(await api.listCalls());
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
      data={calls}
      keyExtractor={(c) => c.id}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void load()} />
      }
      ListEmptyComponent={
        <Text style={styles.empty}>
          No calls yet. When your AI persona answers a forwarded call, the
          summary appears here.
        </Text>
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.from}>
              {item.callerName ?? item.callerNumber}
            </Text>
            <Text style={[styles.urgency, { color: urgencyColor[item.urgency] }]}>
              {item.urgency.toUpperCase()}
            </Text>
          </View>
          {item.reason ? <Text style={styles.body}>{item.reason}</Text> : null}
          {item.messageForUser ? (
            <View style={styles.relay}>
              <Text style={styles.relayLabel}>MESSAGE FOR YOU</Text>
              <Text style={styles.body}>{item.messageForUser}</Text>
            </View>
          ) : null}
          {item.bookedEventId ? (
            <Text style={styles.booked}>
              Appointment penciled in — review it in Approvals
            </Text>
          ) : null}
          {item.callbackRequested ? (
            <Text style={styles.callback}>Callback requested</Text>
          ) : null}
          <Text style={styles.time}>
            {new Date(item.createdAt).toLocaleString()}
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
  headerRow: { flexDirection: "row", justifyContent: "space-between" },
  from: { color: colors.accentBlue, fontWeight: "600" },
  urgency: { fontSize: 11, fontWeight: "700" },
  body: { color: colors.text, marginTop: 6 },
  callback: { color: colors.warn, marginTop: 6, fontWeight: "600" },
  booked: { color: colors.accent, marginTop: 6, fontWeight: "600" },
  relay: {
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  relayLabel: { color: colors.warn, fontSize: 10, fontWeight: "700" },
  time: { color: colors.textDim, fontSize: 12, marginTop: 6 },
});
