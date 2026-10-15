#!/bin/sh
# 배경음악을 끊김 없는 반복용으로: 끝(잦아드는 부분) 3초를 처음 3초와 겹쳐 섞고, 반복은 3초 지점부터 시작
# 사용: sh scripts/make-loops.sh
set -e
loop() { # 원본 끝자르기(초) 출력
  src=$1; end=$2; out=$3; x=3
  ffmpeg -loglevel error -y -i "$src" -filter_complex "\
[0:a]atrim=$x:$(echo "$end - $x" | bc),asetpts=PTS-STARTPTS[a];\
[0:a]atrim=$(echo "$end - $x" | bc):$end,asetpts=PTS-STARTPTS,afade=t=out:st=0:d=$x[b];\
[0:a]atrim=0:$x,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=$x[c];\
[b][c]amix=inputs=2:normalize=0[m];[a][m]concat=n=2:v=0:a=1[o]" -map "[o]" -b:a 96k -ac 2 "$out"
}
mkdir -p public/assets/audio
loop assets-src/music/Hearth_of_Hestia.mp3 196.5 public/assets/audio/hearth_of_hestia.mp3
loop assets-src/music/Athenas_Quiet_Study.mp3 205.5 public/assets/audio/athenas_quiet_study.mp3
