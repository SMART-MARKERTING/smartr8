import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Href, router } from "expo-router";
import React from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const FUNNELS = [
  {
    id: "heloc",
    title: "HELOC",
    subtitle: "Home Equity Line of Credit",
    description: "Tap your home's equity for renovations, debt payoff, or reserves.",
    icon: "home-outline" as const,
    route: "/heloc",
  },
  {
    id: "cashout",
    title: "Cash-Out Refi",
    subtitle: "Refinance & Pull Cash",
    description: "Refinance your mortgage and access your home's equity in cash.",
    icon: "cash-outline" as const,
    route: "/cashout",
  },
  {
    id: "rate-reduction",
    title: "Rate Reduction",
    subtitle: "Lower Your Rate",
    description: "Refinance to a lower rate and reduce your monthly payment.",
    icon: "trending-down-outline" as const,
    route: "/rate-reduction",
  },
  {
    id: "purchase",
    title: "Purchase",
    subtitle: "Buy a Home",
    description: "Get pre-approved for a purchase loan with competitive rates.",
    icon: "key-outline" as const,
    route: "/purchase",
  },
] as const;

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 34 : insets.bottom;

  const handleSelect = (route: Href) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(route);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomPad + 24 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.hero, { paddingTop: topPad + 20 }]}>
          <Text style={[styles.brand, { color: colors.primary }]}>ADAXA HOME</Text>
          <Text style={[styles.headline, { color: colors.foreground }]}>
            {"Get Your Home\nWorking For You"}
          </Text>
          <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
            Quick quotes. No credit pull. Real options.
          </Text>
        </View>

        <View style={styles.cardsSection}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
            CHOOSE YOUR GOAL
          </Text>
          <View style={styles.cards}>
            {FUNNELS.map((funnel) => (
              <FunnelCard
                key={funnel.id}
                title={funnel.title}
                subtitle={funnel.subtitle}
                description={funnel.description}
                icon={funnel.icon}
                onPress={() => handleSelect(funnel.route)}
                colors={colors}
              />
            ))}
          </View>
        </View>

        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <Text style={[styles.footerName, { color: colors.foreground }]}>Mykoal DeShazo</Text>
          <Text style={[styles.footerTitle, { color: colors.mutedForeground }]}>
            VP & Senior Loan Officer · Adaxa Home LLC
          </Text>
          <Text style={[styles.footerNmls, { color: colors.mutedForeground }]}>
            NMLS #1912347 · Company NMLS #2380533
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function FunnelCard({
  title,
  subtitle,
  description,
  icon,
  onPress,
  colors,
}: {
  title: string;
  subtitle: string;
  description: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable
      onPress={onPress}
      testID={`funnel-card-${title.toLowerCase().replace(/\s+/g, "-")}`}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
          transform: pressed ? [{ scale: 0.985 }] : [],
        },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: colors.secondary }]}>
        <Ionicons name={icon} size={26} color={colors.primary} />
      </View>
      <View style={styles.cardText}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.cardSubtitle, { color: colors.primary }]}>{subtitle}</Text>
        <Text style={[styles.cardDesc, { color: colors.mutedForeground }]}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: { paddingHorizontal: 24, paddingBottom: 32 },
  brand: { fontSize: 12, fontFamily: "Inter_700Bold", letterSpacing: 2.5, marginBottom: 20 },
  headline: {
    fontSize: 34,
    fontFamily: "Inter_700Bold",
    lineHeight: 42,
    marginBottom: 10,
  },
  tagline: { fontSize: 16, fontFamily: "Inter_400Regular", lineHeight: 24 },
  cardsSection: { paddingHorizontal: 16 },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.5,
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  cards: { gap: 10 },
  card: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  iconWrap: {
    width: 50,
    height: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 17, fontFamily: "Inter_700Bold", marginBottom: 2 },
  cardSubtitle: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  cardDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  footer: {
    marginTop: 32,
    marginHorizontal: 16,
    paddingTop: 20,
    borderTopWidth: 1,
    alignItems: "center",
    gap: 4,
  },
  footerName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  footerTitle: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
  footerNmls: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center" },
});
