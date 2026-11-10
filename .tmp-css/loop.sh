#!/bin/bash
# Repete: gera final.css com os !important já provados necessários, compara, acumula restaurações.
cd /vercel/Hora-Extra
export HE_PASSWORD='HeE2E-teste-2026!' HE_OWNER_EMAIL=he-e2e-owner@example.com
for i in 1 2 3 4 5 6; do
  node .tmp-css/build-css.mjs /tmp/css /tmp/css/restore.json > /tmp/build-$i.log 2>&1
  before=$(node -e "console.log(require('/tmp/css/restore.json').length)" 2>/dev/null || echo 0)
  node .tmp-css/capture.mjs /tmp/css ${VARIANTS:-final} > /tmp/loop-$i.log 2>&1
  after=$(node -e "console.log(require('/tmp/css/restore.json').length)")
  echo "iter $i restore=$after $(head -1 /tmp/loop-$i.log)" >> /tmp/loop.log
  [ "$before" = "$after" ] && break
  VARIANTS=final
done
echo DONE >> /tmp/loop.log
