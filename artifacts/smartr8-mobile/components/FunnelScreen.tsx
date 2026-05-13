import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useColors } from "@/hooks/useColors";

interface FunnelScreenProps {
  step: number;
  totalSteps: number;
  onBack?: () => void;
  children: React.ReactNode;
  label?: string;
}

export function FunnelScreen({ step, totalSteps, onBack, children, label }: FunnelScreenProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top;
  const progress = step / totalSteps;

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onBack?.();
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <View style={styles.headerRow}>
          {onBack ? (
            <Pressable
              onPress={handleBack}
              hitSlop={12}
              style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.5 : 1 }]}
              testID="back-button"
            >
              <Ionicons name="chevron-back" size={24} color={colors.foreground} />
            </Pressable>
          ) : (
            <View style={styles.backBtnPlaceholder} />
          )}
          <View style={styles.brandArea}>
            <Text style={[styles.brandText, { color: colors.primary }]}>ADAXA HOME</Text>
            {label ? (
              <Text style={[styles.funnelLabel, { color: colors.mutedForeground }]}>{label}</Text>
            ) : null}
          </View>
          <View style={styles.stepLabel}>
            <Text style={[styles.stepText, { color: colors.mutedForeground }]}>
              {step}/{totalSteps}
            </Text>
          </View>
        </View>
        <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
          <View style={[styles.progressFill, { flex: progress, backgroundColor: colors.primary }]} />
          <View style={{ flex: 1 - progress }} />
        </View>
      </View>

      <KeyboardAwareScrollViewCompat
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: (isWeb ? 34 : insets.bottom) + 32 },
        ]}
        bottomOffset={80}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

interface ChoiceCardProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}

export function ChoiceCard({ label, selected, onPress, testID }: ChoiceCardProps) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.choiceCard,
        {
          backgroundColor: selected ? colors.primary : colors.card,
          borderColor: selected ? colors.primary : colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text
        style={[
          styles.choiceLabel,
          { color: selected ? colors.primaryForeground : colors.foreground },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

interface MultiChoiceCardProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}

export function MultiChoiceCard({ label, selected, onPress, testID }: MultiChoiceCardProps) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.choiceCard,
        {
          backgroundColor: selected ? colors.primary : colors.card,
          borderColor: selected ? colors.primary : colors.border,
          opacity: pressed ? 0.85 : 1,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        },
      ]}
    >
      <Text
        style={[
          styles.choiceLabel,
          { color: selected ? colors.primaryForeground : colors.foreground, flex: 1 },
        ]}
      >
        {label}
      </Text>
      {selected && (
        <Ionicons name="checkmark-circle" size={20} color={colors.primaryForeground} />
      )}
    </Pressable>
  );
}

interface FunnelInputProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: TextInputProps["keyboardType"];
  autoCapitalize?: TextInputProps["autoCapitalize"];
  maxLength?: number;
  testID?: string;
  returnKeyType?: TextInputProps["returnKeyType"];
  onSubmitEditing?: () => void;
}

export function FunnelInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  autoCapitalize = "words",
  maxLength,
  testID,
  returnKeyType = "done",
  onSubmitEditing,
}: FunnelInputProps) {
  const colors = useColors();
  return (
    <View style={styles.inputWrapper}>
      <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        maxLength={maxLength}
        testID={testID}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        style={[
          styles.inputText,
          {
            color: colors.foreground,
            backgroundColor: colors.secondary,
            borderColor: colors.border,
          },
        ]}
      />
    </View>
  );
}

interface FunnelButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "accent";
  testID?: string;
}

export function FunnelButton({ label, onPress, disabled, variant = "primary", testID }: FunnelButtonProps) {
  const colors = useColors();
  const bg = variant === "accent" ? colors.accent : colors.primary;
  const fg = variant === "accent" ? colors.accentForeground : colors.primaryForeground;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: bg,
          opacity: disabled ? 0.45 : pressed ? 0.88 : 1,
          borderRadius: 12,
        },
      ]}
    >
      <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function StepHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  const colors = useColors();
  return (
    <View style={styles.headingBlock}>
      <Text style={[styles.heading, { color: colors.foreground }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subheading, { color: colors.mutedForeground }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

export function ConsentNote() {
  const colors = useColors();
  return (
    <View style={[styles.consent, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
      <Text style={[styles.consentText, { color: colors.mutedForeground }]}>
        By submitting, you agree to be contacted by Mykoal DeShazo at Adaxa Home regarding your inquiry. Consent is not a condition of any service. Standard rates may apply.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  backBtnPlaceholder: { width: 36 },
  brandArea: { flex: 1, alignItems: "center" },
  brandText: { fontSize: 13, fontFamily: "Inter_700Bold", letterSpacing: 2 },
  funnelLabel: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 1 },
  stepLabel: { width: 36, alignItems: "flex-end" },
  stepText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  progressTrack: { height: 3, borderRadius: 2, overflow: "hidden", flexDirection: "row" },
  progressFill: { height: 3, borderRadius: 2 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 8 },
  choiceCard: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 10,
  },
  choiceLabel: { fontSize: 16, fontFamily: "Inter_500Medium" },
  inputWrapper: { marginBottom: 14 },
  inputLabel: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 6 },
  inputText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderRadius: 10,
  },
  button: { paddingVertical: 17, alignItems: "center", marginTop: 8 },
  buttonText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  headingBlock: { marginBottom: 24 },
  heading: { fontSize: 24, fontFamily: "Inter_700Bold", lineHeight: 32, marginBottom: 6 },
  subheading: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22 },
  consent: { borderWidth: 1, borderRadius: 10, padding: 14, marginBottom: 10 },
  consentText: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
});
