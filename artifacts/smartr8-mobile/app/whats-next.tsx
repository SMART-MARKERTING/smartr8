import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect } from "react";
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { getRateEstimate } from "@/lib/rateEstimate";

const FUNNEL_LABELS: Record<string, string> = {
  heloc: "HELOC",
  cashout: "Cash-Out Refinance",
  "rate-reduction": "Rate Reduction",
  purchase: "Home Purchase",
};

export default function WhatsNextScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 34 : insets.bottom;
  const { funnel, name, creditScore } = useLocalSearchParams<{ funnel: string; name: string; creditScore: string }>();
  const funnelLabel = FUNNEL_LABELS[funnel] ?? "Loan";
  const rateEst = getRateEstimate(creditScore ?? "", funnel ?? "");

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const callMykoal = () => {
    Linking.openURL("tel:9494185486");
  };

  const emailMykoal = () => {
    Linking.openURL("mailto:mykoal@adaxahome.com?subject=Inquiry%20from%20SMARTR8%20App");
  };

  const bookCall = () => {
    WebBrowser.openBrowserAsync("https://cal.com/mykoal-deshazo/consult");
  };

  const startOver = () => {
    router.replace("/");
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: topPad + 20,
          paddingBottom: bottomPad + 32,
          paddingHorizontal: 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.checkCircle}>
          <View style={[styles.circle, { backgroundColor: colors.primary }]}>
            <Ionicons name="checkmark" size={40} color={colors.primaryForeground} />
          </View>
        </View>

        <Text style={[styles.heading, { color: colors.foreground }]}>
          {"You're all set,\n"}
          {name ? `${name}!` : "thank you!"}
        </Text>
        <Text style={[styles.subheading, { color: colors.mutedForeground }]}>
          Your {funnelLabel} inquiry has been received. Mykoal will review your information and reach out personally — typically within a few hours.
        </Text>

        {rateEst && (
          <View style={[styles.rateCard, { backgroundColor: colors.primary }]} testID="rate-estimate-card">
            <View style={styles.rateCardHeader}>
              <Ionicons name="trending-down-outline" size={18} color={colors.primaryForeground} />
              <Text style={[styles.rateCardLabel, { color: colors.primaryForeground }]}>Your estimated rate</Text>
            </View>
            <Text style={[styles.rateRange, { color: colors.primaryForeground }]}>
              {rateEst.low}% – {rateEst.high}%
            </Text>
            <Text style={[styles.rateType, { color: colors.primaryForeground }]}>{rateEst.label}</Text>
            <View style={[styles.rateDivider, { backgroundColor: "rgba(255,255,255,0.25)" }]} />
            <Text style={[styles.rateDisclaimer, { color: "rgba(255,255,255,0.75)" }]}>
              Estimate based on your credit profile. Final rate depends on full underwriting, LTV, and current market conditions.
            </Text>
          </View>
        )}

        <View style={[styles.card, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text style={[styles.avatarText, { color: colors.primaryForeground }]}>MD</Text>
            </View>
            <View>
              <Text style={[styles.cardName, { color: colors.foreground }]}>Mykoal DeShazo</Text>
              <Text style={[styles.cardTitle, { color: colors.mutedForeground }]}>VP & Senior Loan Officer</Text>
              <Text style={[styles.cardTitle, { color: colors.mutedForeground }]}>Adaxa Home LLC</Text>
            </View>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.contactBtns}>
            <Pressable
              onPress={callMykoal}
              testID="btn-call"
              style={({ pressed }) => [styles.contactBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
            >
              <Ionicons name="call-outline" size={18} color={colors.primaryForeground} />
              <Text style={[styles.contactBtnText, { color: colors.primaryForeground }]}>(949) 418-5486</Text>
            </Pressable>
            <Pressable
              onPress={emailMykoal}
              testID="btn-email"
              style={({ pressed }) => [styles.contactBtn, { backgroundColor: colors.secondary, borderWidth:1.5, borderColor:colors.border, opacity: pressed ? 0.85 : 1 }]}
            >
              <Ionicons name="mail-outline" size={18} color={colors.foreground} />
              <Text style={[styles.contactBtnText, { color: colors.foreground }]}>Send Email</Text>
            </Pressable>
          </View>
        </View>

        <Pressable
          onPress={bookCall}
          testID="btn-book-call"
          style={({ pressed }) => [styles.bookBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
        >
          <Ionicons name="calendar-outline" size={18} color={colors.primaryForeground} />
          <Text style={[styles.bookBtnText, { color: colors.primaryForeground }]}>Book a Free Call</Text>
        </Pressable>

        <View style={styles.steps}>
          <Text style={[styles.stepsTitle, { color: colors.foreground }]}>What happens next?</Text>
          {[
            { icon: "search-outline" as const, text: "Mykoal reviews your loan profile and matches it to available programs." },
            { icon: "chatbubble-outline" as const, text: "You'll get a personal call or text — no bots, no call centers." },
            { icon: "document-text-outline" as const, text: "If it's a fit, Mykoal will walk you through options with no obligation." },
          ].map((item, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={[styles.stepIcon, { backgroundColor: colors.secondary }]}>
                <Ionicons name={item.icon} size={18} color={colors.primary} />
              </View>
              <Text style={[styles.stepText, { color: colors.mutedForeground }]}>{item.text}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.nmls, { color: colors.mutedForeground }]}>
          NMLS #1912347 · Company NMLS #2380533
        </Text>

        <Pressable
          onPress={startOver}
          testID="btn-start-over"
          style={({ pressed }) => [styles.startOver, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={[styles.startOverText, { color: colors.mutedForeground }]}>Explore another loan option</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  checkCircle: { alignItems: "center", marginBottom: 28 },
  circle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  heading: { fontSize: 30, fontFamily: "Inter_700Bold", lineHeight: 38, marginBottom: 12 },
  subheading: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 23, marginBottom: 28 },
  card: { borderWidth: 1.5, borderRadius: 16, padding: 20, marginBottom: 28 },
  cardHeader: { flexDirection: "row", gap: 14, alignItems: "center", marginBottom: 16 },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 18, fontFamily: "Inter_700Bold" },
  cardName: { fontSize: 16, fontFamily: "Inter_700Bold" },
  cardTitle: { fontSize: 13, fontFamily: "Inter_400Regular" },
  divider: { height: 1, marginBottom: 16 },
  contactBtns: { flexDirection: "row", gap: 10 },
  contactBtn: { flex: 1, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", borderRadius: 10, paddingVertical: 12 },
  contactBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  steps: { marginBottom: 24 },
  stepsTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 14 },
  stepRow: { flexDirection: "row", gap: 12, alignItems: "flex-start", marginBottom: 14 },
  stepIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  stepText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20, paddingTop: 8 },
  rateCard: { borderRadius: 16, padding: 20, marginBottom: 24 },
  rateCardHeader: { flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 8 },
  rateCardLabel: { fontSize: 13, fontFamily: "Inter_500Medium", opacity: 0.9 },
  rateRange: { fontSize: 36, fontFamily: "Inter_700Bold", letterSpacing: -0.5, marginBottom: 2 },
  rateType: { fontSize: 13, fontFamily: "Inter_400Regular", opacity: 0.85, marginBottom: 16 },
  rateDivider: { height: 1, marginBottom: 12 },
  rateDisclaimer: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },
  bookBtn: { flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center", borderRadius: 12, paddingVertical: 16, marginBottom: 24 },
  bookBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  nmls: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", marginBottom: 20 },
  startOver: { alignItems: "center", paddingVertical: 8 },
  startOverText: { fontSize: 14, fontFamily: "Inter_500Medium", textDecorationLine: "underline" },
});
