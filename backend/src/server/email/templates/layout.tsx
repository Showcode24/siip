import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

export const brand = {
  green: "#008751",
  dark: "#0b2e1f",
  muted: "#5b6b63",
  background: "#f4f7f5",
};

interface LayoutProps {
  preview: string;
  heading: string;
  children: ReactNode;
}

export function Layout({ preview, heading, children }: LayoutProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: brand.background, fontFamily: "Helvetica, Arial, sans-serif" }}>
        <Container
          style={{ maxWidth: 560, margin: "24px auto", backgroundColor: "#ffffff", borderRadius: 8 }}
        >
          <Section
            style={{ backgroundColor: brand.green, padding: "20px 32px", borderRadius: "8px 8px 0 0" }}
          >
            <Text style={{ color: "#ffffff", fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: 1 }}>
              SIIP
            </Text>
            <Text style={{ color: "#d6f0e3", fontSize: 12, margin: 0 }}>
              Graduate Internship &amp; Development Programme
            </Text>
          </Section>
          <Section style={{ padding: "24px 32px" }}>
            <Heading as="h1" style={{ color: brand.dark, fontSize: 20, margin: "0 0 16px" }}>
              {heading}
            </Heading>
            {children}
          </Section>
          <Hr style={{ borderColor: "#e3e9e6", margin: 0 }} />
          <Section style={{ padding: "16px 32px" }}>
            <Text style={{ color: brand.muted, fontSize: 12, margin: 0 }}>
              You are receiving this email because you have an account with SIIP. SIIP is free. We will never
              ask you to pay for registration, training or placement.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <Text style={{ color: brand.dark, fontSize: 15, lineHeight: "24px" }}>{children}</Text>;
}

export function CTA({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Section style={{ margin: "24px 0" }}>
      <Button
        href={href}
        style={{
          backgroundColor: brand.green,
          color: "#ffffff",
          padding: "12px 20px",
          borderRadius: 6,
          fontSize: 15,
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        {children}
      </Button>
    </Section>
  );
}

export function Small({ children }: { children: ReactNode }) {
  return <Text style={{ color: brand.muted, fontSize: 13, lineHeight: "20px" }}>{children}</Text>;
}
