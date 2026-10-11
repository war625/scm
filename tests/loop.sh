#!/bin/bash
# Lv.2 자동 루프: 검증 실패 → 실패 출력을 에이전트에 전달 → 수정 → 재검증 (통과 or 최대 MAX회)
#   사용: MAX=5 bash tests/loop.sh
cd "$(dirname "$0")/.." || exit 1
MAX=${MAX:-5}
PROTECTED="tests/SPEC.md tests/verify.cjs"
guard() { git diff --quiet HEAD -- $PROTECTED; }   # 스펙·검증기 변조 감지 (커밋된 상태 기준)
prev=""
for i in $(seq 1 "$MAX"); do
  out=$(bash tests/run.sh); code=$?
  echo "── 시도 $i/$MAX ─ 검증 결과 ──"; echo "$out"
  if [ $code -eq 0 ]; then echo "✅ 통과 (시도 $i)"; exit 0; fi
  hint=""
  [ "$out" = "$prev" ] && hint="직전과 동일한 실패입니다. 같은 수정을 반복하지 말고 원인을 다시 조사해 다른 접근을 시도하세요."
  prev="$out"
  claude -p --permission-mode acceptEdits --allowedTools "Read Edit Grep Glob" <<EOP | sed 's/^/  [agent] /'
product.html 상품등록 기능의 자동 검증이 실패했습니다. 아래 실패 출력과 tests/SPEC.md 를 근거로 원인을 찾아 js/ 또는 product.html 만 수정하세요.
tests/ 아래 파일은 절대 수정 금지입니다. 수정 후 한 줄로 무엇을 왜 고쳤는지만 답하세요. $hint

$out
EOP
  if ! guard; then echo "🚫 에이전트가 tests/ 를 변조 → 되돌리고 중단"; git checkout -- $PROTECTED; exit 2; fi
done
echo "❌ $MAX회 내 통과 실패 → 사람 개입 필요"; exit 1
