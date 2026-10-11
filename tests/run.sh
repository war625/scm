#!/bin/bash
# 검증 한 줄 실행: bash tests/run.sh  (실패 시 exit 1 → 루프가 이 출력을 피드백으로 사용)
cd "$(dirname "$0")/.." || exit 1
NODE_PATH="$(npm root -g)" node tests/verify.cjs 2>&1 | grep -E "^(PASS|FAIL)"
exit "${PIPESTATUS[0]}"
