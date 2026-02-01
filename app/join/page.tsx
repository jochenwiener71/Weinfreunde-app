"use client";

export default function JoinPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        position: "relative",
        overflow: "hidden",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont",
      }}
    >
      {/* Hintergrundbild */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "url('/join-bg.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "blur(2px)",
          transform: "scale(1.05)", // verhindert Blur-Ränder
        }}
      />

      {/* Dunkler Verlauf */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.75) 60%, rgba(0,0,0,0.9) 100%)",
        }}
      />

      {/* Inhalt */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 420,
            background: "rgba(20,20,20,0.75)",
            backdropFilter: "blur(6px)",
            borderRadius: 16,
            padding: 28,
            boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            color: "white",
          }}
        >
          <h1
            style={{
              marginTop: 0,
              marginBottom: 8,
              fontSize: 26,
              textAlign: "center",
              letterSpacing: 0.3,
            }}
          >
            🍷 Weinprobe
          </h1>

          <p
            style={{
              textAlign: "center",
              opacity: 0.85,
              marginTop: 0,
              marginBottom: 24,
            }}
          >
            Bitte registriere dich zur Teilnahme
          </p>

          {/* 👉 HIER kommt dein bestehendes Join-Formular rein */}
          {/* Beispiel-Platzhalter */}
          <div style={{ display: "grid", gap: 12 }}>
            <input
              placeholder="Dein Vorname"
              style={inputStyle}
            />
            <input
              placeholder="PIN"
              inputMode="numeric"
              style={inputStyle}
            />
            <button style={buttonStyle}>
              Beitreten
            </button>
          </div>

          <p
            style={{
              marginTop: 16,
              fontSize: 12,
              opacity: 0.6,
              textAlign: "center",
            }}
          >
            Nach der Registrierung kannst du die Weine bewerten,
            sobald die Verkostung startet.
          </p>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 10,
  border: "none",
  outline: "none",
  fontSize: 16,
};

const buttonStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 10,
  border: "none",
  background: "linear-gradient(135deg, #8e0e00, #c0392b)",
  color: "white",
  fontSize: 16,
  fontWeight: 600,
  cursor: "pointer",
};
