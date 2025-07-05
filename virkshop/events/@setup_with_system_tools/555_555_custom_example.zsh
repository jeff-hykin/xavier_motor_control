setopt INTERACTIVE_COMMENTS

HISTFILE="$HOME/.zsh_history"

# Number of lines kept in the history file
HISTSIZE=10000

# Number of lines kept in memory during a session
SAVEHIST=10000

# enable auto complete
# autoload -Uz compinit
# compinit

# autoload bashcompinit
# bashcompinit

unalias -m '*' # remove all default aliases


alias ll="ls -l"