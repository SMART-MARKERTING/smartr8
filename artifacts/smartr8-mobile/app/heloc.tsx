import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import {
  ChoiceCard,
  FunnelButton,
  FunnelInput,
  FunnelScreen,
  MultiChoiceCard,
  StepHeading,
} from "@/components/FunnelScreen";
import { submitLead } from "@/lib/submitLead";

const TOTAL = 9;
const HOME_VALUE_RANGES = ["Under $300,000","$300,000 – $500,000","$500,000 – $750,000","$750,000 – $1,000,000","$1,000,000 – $1,500,000","Over $1,500,000"];
const MORTGAGE_RANGES = ["Under $200,000","$200,000 – $400,000","$400,000 – $600,000","$600,000 – $800,000","$800,000 – $1,000,000","Over $1,000,000","No mortgage"];
const HELOC_PURPOSES = ["Home renovation or addition","Debt consolidation","Investment property purchase","Business or self-employment capital","Emergency reserve / access to funds","Something else"];
const TIMELINE_OPTIONS = ["As soon as possible","Within 1 to 3 months","Just exploring options"];
const CREDIT_RANGES = ["580 – 619","620 – 659","660 – 699","700 – 739","740 – 779","780+","Not sure"];

type FS = {
  step: number;
  firstName: string; lastName: string;
  address: string; city: string; stateCode: string; zip: string;
  homeValue: string;
  mortgageBalance: string;
  helocPurposes: string[]; timeline: string; creditScore: string;
  dobMonth: string; dobDay: string; dobYear: string;
  email: string; phone: string; consent: boolean;
};
const DEFAULT: FS = { step:1, firstName:"", lastName:"", address:"", city:"", stateCode:"", zip:"", homeValue:"", mortgageBalance:"", helocPurposes:[], timeline:"", creditScore:"", dobMonth:"", dobDay:"", dobYear:"", email:"", phone:"", consent:false };

export default function HelocFunnel() {
  const colors = useColors();
  const [st, setSt] = useState<FS>(DEFAULT);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const p = (patch: Partial<FS>) => setSt((prev) => ({ ...prev, ...patch }));
  const advance = () => setSt((prev) => ({ ...prev, step: prev.step + 1 }));
  const back = () => {
    if (st.step === 1) router.back();
    else setSt((prev) => ({ ...prev, step: prev.step - 1 }));
  };
  const autoAdvance = (patch: Partial<FS>) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSt((prev) => ({ ...prev, ...patch }));
    setTimeout(() => setSt((prev) => ({ ...prev, step: prev.step + 1 })), 300);
  };
  const togglePurpose = (val: string) =>
    p({ helocPurposes: st.helocPurposes.includes(val) ? st.helocPurposes.filter(x => x !== val) : [...st.helocPurposes, val] });

  const dob = `${st.dobMonth.padStart(2,"0")}/${st.dobDay.padStart(2,"0")}/${st.dobYear}`;
  const dobValid = st.dobMonth && st.dobDay && st.dobYear.length === 4;

  const handleSubmit = async () => {
    if (!st.email || !st.phone) { setSubmitError("Please fill in your email and phone."); return; }
    setIsSubmitting(true); setSubmitError("");
    try {
      await submitLead({ funnel:"heloc", firstName:st.firstName, lastName:st.lastName, email:st.email, phone:st.phone, address:st.address, city:st.city, state:st.stateCode, zip:st.zip, homeValue:st.homeValue, mortgageBalance:st.mortgageBalance, creditScore:st.creditScore, dob, additionalFields:{ helocPurposes:st.helocPurposes, timeline:st.timeline } });
      router.replace({ pathname:"/whats-next", params:{ funnel:"heloc", name:st.firstName, creditScore:st.creditScore } });
    } catch { setSubmitError("Something went wrong. Please try again."); setIsSubmitting(false); }
  };

  return (
    <FunnelScreen step={st.step} totalSteps={TOTAL} onBack={back} label="HELOC">
      {st.step === 1 && (
        <>
          <StepHeading title="What's your name?" subtitle="We'll use this to personalize your options." />
          <FunnelInput label="First Name" value={st.firstName} onChangeText={v => p({ firstName:v })} placeholder="Jane" returnKeyType="next" testID="input-firstname" />
          <FunnelInput label="Last Name" value={st.lastName} onChangeText={v => p({ lastName:v })} placeholder="Doe" testID="input-lastname" />
          <FunnelButton label="Continue" onPress={advance} disabled={!st.firstName.trim() || !st.lastName.trim()} testID="btn-continue" />
        </>
      )}
      {st.step === 2 && (
        <>
          <StepHeading title="What's your property address?" subtitle="We use this to find local lending options." />
          <FunnelInput label="Street Address" value={st.address} onChangeText={v => p({ address:v })} placeholder="123 Main St" returnKeyType="next" testID="input-address" />
          <FunnelInput label="City" value={st.city} onChangeText={v => p({ city:v })} placeholder="Newport Beach" returnKeyType="next" testID="input-city" />
          <View style={styles.row}>
            <View style={styles.stateField}>
              <FunnelInput label="State" value={st.stateCode} onChangeText={v => p({ stateCode:v.toUpperCase() })} placeholder="CA" maxLength={2} autoCapitalize="characters" testID="input-state" />
            </View>
            <View style={styles.zipField}>
              <FunnelInput label="ZIP" value={st.zip} onChangeText={v => p({ zip:v })} placeholder="92660" keyboardType="numeric" maxLength={5} testID="input-zip" />
            </View>
          </View>
          <FunnelButton label="Continue" onPress={advance} disabled={!st.address.trim() || !st.city.trim() || !st.stateCode.trim()} testID="btn-continue" />
        </>
      )}
      {st.step === 3 && (
        <>
          <StepHeading title="What's your home's estimated value?" subtitle="A rough estimate is fine." />
          {HOME_VALUE_RANGES.map(opt => <ChoiceCard key={opt} label={opt} selected={st.homeValue === opt} onPress={() => autoAdvance({ homeValue:opt })} testID={`choice-${opt}`} />)}
        </>
      )}
      {st.step === 4 && (
        <>
          <StepHeading title="How much do you owe on your mortgage?" subtitle="An estimate is fine." />
          {MORTGAGE_RANGES.map(opt => <ChoiceCard key={opt} label={opt} selected={st.mortgageBalance === opt} onPress={() => autoAdvance({ mortgageBalance:opt })} testID={`choice-${opt}`} />)}
        </>
      )}
      {st.step === 5 && (
        <>
          <StepHeading title="What will you use the HELOC for?" subtitle="Select all that apply." />
          {HELOC_PURPOSES.map(opt => <MultiChoiceCard key={opt} label={opt} selected={st.helocPurposes.includes(opt)} onPress={() => togglePurpose(opt)} testID={`choice-${opt}`} />)}
          <FunnelButton label="Continue" onPress={advance} disabled={st.helocPurposes.length === 0} testID="btn-continue" />
        </>
      )}
      {st.step === 6 && (
        <>
          <StepHeading title="When are you looking to access the funds?" subtitle="This helps me prioritize the right programs." />
          {TIMELINE_OPTIONS.map(opt => <ChoiceCard key={opt} label={opt} selected={st.timeline === opt} onPress={() => autoAdvance({ timeline:opt })} testID={`choice-${opt}`} />)}
        </>
      )}
      {st.step === 7 && (
        <>
          <StepHeading title="What's your estimated credit score?" subtitle="No credit pull required to see your options." />
          {CREDIT_RANGES.map(opt => <ChoiceCard key={opt} label={opt} selected={st.creditScore === opt} onPress={() => autoAdvance({ creditScore:opt })} testID={`choice-${opt}`} />)}
        </>
      )}
      {st.step === 8 && (
        <>
          <StepHeading title="What's your date of birth?" subtitle="Required for loan program eligibility." />
          <View style={styles.dobRow}>
            <View style={styles.dobMM}>
              <FunnelInput label="Month (MM)" value={st.dobMonth} onChangeText={v => p({ dobMonth:v })} placeholder="01" keyboardType="numeric" maxLength={2} returnKeyType="next" testID="input-dob-month" />
            </View>
            <View style={styles.dobDD}>
              <FunnelInput label="Day (DD)" value={st.dobDay} onChangeText={v => p({ dobDay:v })} placeholder="15" keyboardType="numeric" maxLength={2} returnKeyType="next" testID="input-dob-day" />
            </View>
            <View style={styles.dobYY}>
              <FunnelInput label="Year (YYYY)" value={st.dobYear} onChangeText={v => p({ dobYear:v })} placeholder="1985" keyboardType="numeric" maxLength={4} testID="input-dob-year" />
            </View>
          </View>
          <FunnelButton label="Continue" onPress={advance} disabled={!dobValid} testID="btn-continue" />
        </>
      )}
      {st.step === 9 && (
        <>
          <StepHeading title="How can we reach you?" subtitle="No spam. No credit pull. Real options within hours." />
          <FunnelInput label="Email" value={st.email} onChangeText={v => p({ email:v })} placeholder="jane@example.com" keyboardType="email-address" autoCapitalize="none" returnKeyType="next" testID="input-email" />
          <FunnelInput label="Mobile Phone" value={st.phone} onChangeText={v => p({ phone:v })} placeholder="(555) 555-5555" keyboardType="phone-pad" testID="input-phone" />
          <ConsentNote colors={colors} />
          {submitError ? <Text style={[styles.error, { color:colors.destructive }]}>{submitError}</Text> : null}
          <FunnelButton label={isSubmitting ? "Submitting..." : "Get My HELOC Options"} onPress={handleSubmit} disabled={isSubmitting || !st.email || !st.phone} variant="accent" testID="btn-submit" />
        </>
      )}
    </FunnelScreen>
  );
}

function ConsentNote({ colors }: { colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[styles.consent, { backgroundColor:colors.secondary, borderColor:colors.border }]}>
      <Text style={[styles.consentText, { color:colors.mutedForeground }]}>
        By submitting, you agree to be contacted by Mykoal DeShazo at Adaxa Home regarding your inquiry. Consent is not a condition of any service. Standard rates may apply.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection:"row", gap:10 },
  stateField: { width:80 },
  zipField: { flex:1 },
  dobRow: { flexDirection:"row", gap:10 },
  dobMM: { flex:1 },
  dobDD: { flex:1 },
  dobYY: { flex:1.4 },
  consent: { borderWidth:1, borderRadius:10, padding:14, marginBottom:10 },
  consentText: { fontSize:12, fontFamily:"Inter_400Regular", lineHeight:18 },
  error: { fontSize:13, fontFamily:"Inter_500Medium", marginBottom:10 },
});
