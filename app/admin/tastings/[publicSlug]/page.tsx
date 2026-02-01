<h2>Teilnehmer</h2>

{participants.map((p) => (
  <div key={p.id} style={{ display: "flex", gap: 10 }}>
    <span>{p.alias}</span>

    <button
      onClick={async () => {
        if (!confirm(`Teilnehmer ${p.alias} wirklich löschen?`)) return;

        await fetch("/api/admin/delete-participant", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-secret": adminSecret,
          },
          body: JSON.stringify({
            publicSlug,
            participantId: p.id,
          }),
        });

        load(); // neu laden
      }}
      style={{ color: "crimson" }}
    >
      Löschen
    </button>
  </div>
))}
