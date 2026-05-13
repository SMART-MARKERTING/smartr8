import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { ChoiceCard, FunnelButton, FunnelInput, FunnelScreen, StepHeading } from "@/components/FunnelScreen";
import { submitLead } from "@/lib/submitLead";

const TOTAL = 9;
const PURCHASE_PRICE_RANGES = ["Under $300,000","$300,000 – $500,000","$500,000 – $750,000","$750,000 – $1,000,000","$1,000,000 – $1,500,000","Over $1,500,000"];
const DOWN_PAYMENT_OPTIONS = ["Less than 5%","5% – 10%","10% – 20%","20%+","Not sure yet"];
const PROPERTY_TYPES = ["Primary residence","Second home / vacation","Investment property"];
const LOAN_TYPES = ["VA loan","FHA loan","Conventional","Jumbo","Not sure / show me options"];
const CREDIT_RANGES = ["580 – 619","620 – 659","660 – 699","700 – 739","740 – 779","780+","Not sure"];

type FS = {
  step: number; firstName: string; lastName: string;
  city: string; stateCode: string;
  purchasePrice: string; downPayment: string; propertyType: string; loanType: string; creditScore: string;
  dobMonth: string; dobDay: string; dobYear: string;
  email: string; phone: string;
};
const DEFAULT: FS = { step:1, firstName:"", lastName:"", city:"", stateCode:"", purchasePrice:"", downPayment:"", propertyType:"", loanType:"", creditScore:"", dobMonth:"", dobDay:"", dobYear:"", email:"", phone:"" };

export default function PurchaseFunnel() {
  const colors = useColors();
  const [st, setSt] = useState<FS>(DEFAULT);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const p = (patch: Partial<FS>) => setSt(prev => ({ ...prev, ...patch }));
  const advance = () => setSt(prev => ({ ...prev, step: prev.step + 1 }));
  const back = () => { if (st.step === 1) router.back(); else setSt(prev => ({ ...prev, step: prev.step - 1 })); };
  const autoAdvance = (patch: Partial<FS>) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSt(prev => ({ ...prev, ...patch }));
    setTimeout(() => setSt(prev => ({ ...prev, step: prev.step + 1 })), 300);
  };

  const dob = `${st.dobMonth.padStart(2,"0")}/${st.dobDay.padStart(2,"0")}/${st.dobYear}`;
  const dobValid = st.dobMonth && st.dobDay && st.dobYear.length === 4;
  const locationStr = [st.city, st.stateCode].filter(Boolean).join(", ");

  const handleSubmit = async () => {
    if (!st.email || !st.phone) { setSubmitError("Please fill in your email and phone."); return; }
    setIsSubmitting(true); setSubmitError("");
    try {
      await submitLead({ funnel:"purchase", firstName:st.firstName, lastName:st.lastName, email:st.email, phone:st.phone, address:locationStr, city:st.city, state:st.stateCode, zip:"", creditScore:st.creditScore, dob, additionalFields:{ purchasePrice:st.purchasePrice, downPayment:st.downPayment, propertyType:st.propertyType, loanType:st.loanType } });
      router.replace({ pathname:"/whats-next", params:{ funnel:"purchase", name:st.firstName, creditScore:st.creditScore } });
    } catch { setSubmitError("Something went wrong. Please try again."); setIsSubmitting(false); }
  };

  return (
    <FunnelScreen step={st.step} totalSteps={TOTAL} onBack={back} label="PURCHASE">
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
          <StepHeading title="Where are you looking to buy?" subtitle="City and state is fine if you haven't found a property yet." />
          <FunnelInput label="City" value={st.city} onChangeText={v => p({ city:v })} placeholder="Newport Beach" returnKeyType="next" testID="input-city" />
          <View style={styles.row}>
            <View style={{ width:100 }}><FunnelInput label="State" value={st.stateCode} onChangeText={v => p({ stateCode:v.toUpperCase() })} placeholder="CA" maxLength={2} autoCapitalize="characters" testID="input-state" /></View>
          </View>
          <FunnelButton label="Continue" onPress={advance} disabled={!st.city.trim() || !st.stateCode.trim()} testID="btn-continue" />
        </>
      )}
      {st.step === 3 && (
        <>
          <StepHeading title="What's your target purchase price range?" subtitle="A rough estimate is fine." />
          {PURCHASE_PRICE_RANGES.map(opt => <ChoiceCard key={opt} label={opt} selected={st.purchasePrice === opt} onPress={() => autoAdvance({ purchasePrice:opt })} />)}
        </>
      )}
      {st.step === 4 && (
        <>
          <StepHeading title="How much do you plan to put down?" subtitle="We'll match you to programs that fit your down payment." />
          {DOWN_PAYMENT_OPTIONS.map(opt => <ChoiceCard key={opt} label={opt} selected={st.downPayment === opt} onPress={() => autoAdvance({ downPayment:opt })} />)}
        </>
      )}
      {st.step === 5 && (
        <>
          <StepHeading title="What type of property?" subtitle="This affects available loan programs." />
          {PROPERTY_TYPES.map(opt => <ChoiceCard key={opt} label={opt} selected={st.propertyType === opt} onPress={() => autoAdvance({ propertyType:opt })} />)}
        </>
      )}
      {st.step === 6 && (
        <>
          <StepHeading title="What loan type interests you most?" subtitle="Not sure? Pick the last option and we'll figure it out together." />
          {LOAN_TYPES.map(opt => <ChoiceCard key={opt} label={opt} selected={st.loanType === opt} onPress={() => autoAdvance({ loanType:opt })} />)}
        </>
      )}
      {st.step === 7 && (
        <>
          <StepHeading title="What's your estimated credit score?" subtitle="No credit pull required to see your options." />
          {CREDIT_RANGES.map(opt => <ChoiceCard key={opt} label={opt} selected={st.creditScore === opt} onPress={() => autoAdvance({ creditScore:opt })} />)}
        </>
      )}
      {st.step === 8 && (
        <>
          <StepHeading title="What's your date of birth?" subtitle="Required for loan program eligibility." />
          <View style={styles.dobRow}>
            <View style={styles.dobMM}><FunnelInput label="Month" value={st.dobMonth} onChangeText={v => p({ dobMonth:v })} placeholder="01" keyboardType="numeric" maxLength={2} returnKeyType="next" testID="input-dob-month" /></View>
            <View style={styles.dobDD}><FunnelInput label="Day" value={st.dobDay} onChangeText={v => p({ dobDay:v })} placeholder="15" keyboardType="numeric" maxLength={2} returnKeyType="next" testID="input-dob-day" /></View>
            <View style={styles.dobYY}><FunnelInput label="Year" value={st.dobYear} onChangeText={v => p({ dobYear:v })} placeholder="1985" keyboardType="numeric" maxLength={4} testID="input-dob-year" /></View>
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
          <FunnelButton label={isSubmitting ? "Submitting..." : "Get My Pre-Approval Options"} onPress={handleSubmit} disabled={isSubmitting || !st.email || !st.phone} variant="accent" testID="btn-submit" />
        </>
      )}
    </FunnelScreen>
  );
}

function ConsentNote({ colors }: { colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[styles.consent, { backgroundColor:colors.secondary, borderColor:colors.border }]}>
      <Text style={[styles.consentText, { color:colors.mutedForeground }]}>
        By submitting, you agree to be contacted by Mykoal DeShazo at Adaxa Home regarding your inquiry. Consent is not a condition of any service.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection:"row", gap:10 },
  dobRow: { flexDirection:"row", gap:10 },
  dobMM: { flex:1 },
  dobDD: { flex:1 },
  dobYY: { flex:1.4 },
  consent: { borderWidth:1, borderRadius:10, padding:14, marginBottom:10 },
  consentText: { fontSize:12, fontFamily:"Inter_400Regular", lineHeight:18 },
  error: { fontSize:13, fontFamily:"Inter_500Medium", marginBottom:10 },
});
