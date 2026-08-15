#!/bin/sh

cat >.git/hooks/pre-commit <<\EOF
#!/bin/sh
set -o noglob

bunx prettier --write src

for file in $(git diff --cached --name-only); do
  test -f $file && git add $file
done
EOF

chmod +x .git/hooks/pre-commit
