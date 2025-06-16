# # uncomment to add /usr/bin to your PATH inside of the virkshop
# export PATH="/usr/bin:$PATH"

# # uncomment for a small command line shortcut
alias ll="ls -l"
touch "$HOME/.zsh_history"

export PATH="$PATH:$PWD/run"
export SCONS_LIB_DIR="$(dirname "$(dirname "$(which scons)")")/lib/python3.11/site-packages/scons"

# 
# activate venv
# 
if [ -d ".venv" ]
then
    . .venv/bin/activate
fi