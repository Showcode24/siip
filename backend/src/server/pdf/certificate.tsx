import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";

export interface CertificateData {
  graduateName: string;
  cohortName: string;
  companyName: string;
  roleTitle: string;
  startDate: string;
  endDate: string;
  issueDate: string;
  serialNumber: string;
  verificationCode: string;
  verifyUrl: string;
}

const green = "#008751";
const dark = "#0b2e1f";
const muted = "#5b6b63";

const s = StyleSheet.create({
  page: { padding: 36, fontFamily: "Helvetica", color: dark },
  frame: { flex: 1, borderWidth: 3, borderColor: green, padding: 36, alignItems: "center" },
  brand: { fontSize: 28, fontFamily: "Helvetica-Bold", color: green, letterSpacing: 4 },
  tagline: { fontSize: 10, color: muted, marginTop: 4 },
  title: { fontSize: 24, fontFamily: "Helvetica-Bold", marginTop: 36 },
  lead: { fontSize: 12, color: muted, marginTop: 18 },
  name: { fontSize: 30, fontFamily: "Helvetica-Bold", marginTop: 12 },
  body: { fontSize: 12, marginTop: 18, textAlign: "center", lineHeight: 1.6, maxWidth: 520 },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  small: { fontSize: 9, color: muted },
});

function CertificateDocument(d: CertificateData) {
  return (
    <Document title={`SIIP Certificate ${d.serialNumber}`} author="SIIP">
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.frame}>
          <Text style={s.brand}>SIIP</Text>
          <Text style={s.tagline}>Graduate Internship &amp; Development Programme</Text>
          <Text style={s.title}>Certificate of Completion</Text>
          <Text style={s.lead}>This certifies that</Text>
          <Text style={s.name}>{d.graduateName}</Text>
          <Text style={s.body}>
            completed a SIIP internship with verified skills as{" "}
            {d.roleTitle} at {d.companyName}, from {d.startDate} to {d.endDate}.
          </Text>
          <View style={s.footer}>
            <View>
              <Text style={s.small}>Issued: {d.issueDate}</Text>
              <Text style={s.small}>Serial: {d.serialNumber}</Text>
            </View>
            <View>
              <Text style={s.small}>Verification code: {d.verificationCode}</Text>
              <Text style={s.small}>Verify at {d.verifyUrl}</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export function renderCertificatePdf(data: CertificateData): Promise<Buffer> {
  return renderToBuffer(CertificateDocument(data));
}
