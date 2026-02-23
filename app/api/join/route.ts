BASE="https://weinfreunde-app.vercel.app"
SLUG="weinfreunde-feb26"
PIN="1234"   # <-- DEINE PIN (gemeinsam)

# Kriterien-IDs (aus deinem summary JSON)
C1="99byDuwCbHZdbGmOTxBO"  # Nase
C2="Xugdv501ZlvYDEy5CqkP"  # Gaumen
C3="PF3YPc4gzkQD1jIUXcAK"  # Balance
C4="ng8RSlmVlzG9LLzKqWc6"  # Gesamteindruck

# welche Weine sollen bewertet werden (hier nur 1 und 5 zum schnellen Check)
WINES=(1 5)

echo "== Precheck: summary vorher =="
curl -sS "$BASE/api/tasting/summary?publicSlug=$SLUG"
echo
echo

for i in 1 2 3 4 5 6 7 8; do
  JAR="cookies_user${i}.txt"
  NAME="Tester${i}"

  echo "=============================="
  echo "USER $i: JOIN ($NAME)"
  echo "=============================="

  curl -sS \
    -c "$JAR" \
    -H "content-type: application/json" \
    -X POST "$BASE/api/join" \
    --data "{\"slug\":\"$SLUG\",\"name\":\"$NAME\",\"pin\":\"$PIN\"}"
  echo

  echo "USER $i: SESSION CHECK"
  curl -sS -b "$JAR" "$BASE/api/session/check"
  echo

  for W in "${WINES[@]}"; do
    # deterministische Scores je User + Wein (1..10)
    S1=$(( (i + W) % 10 + 1 ))
    S2=$(( (i + W + 2) % 10 + 1 ))
    S3=$(( (i + W + 4) % 10 + 1 ))
    S4=$(( (i + W + 6) % 10 + 1 ))

    echo
    echo "USER $i: SAVE rating wine=$W  (scores: $S1,$S2,$S3,$S4)"

    curl -sS \
      -b "$JAR" \
      -H "content-type: application/json" \
      -X POST "$BASE/api/rating/save" \
      --data "{
        \"slug\":\"$SLUG\",
        \"blindNumber\":$W,
        \"scores\":{
          \"$C1\":$S1,
          \"$C2\":$S2,
          \"$C3\":$S3,
          \"$C4\":$S4
        },
        \"comment\":\"SimUser $i wine $W\"
      }"
    echo

    echo "USER $i: GET rating wine=$W"
    curl -sS -b "$JAR" "$BASE/api/rating/get?slug=$SLUG&blindNumber=$W"
    echo
  done

  echo
  echo "------------------------------"
  echo
done

echo "== Summary nach Simulation =="
curl -sS "$BASE/api/tasting/summary?publicSlug=$SLUG"
echo
