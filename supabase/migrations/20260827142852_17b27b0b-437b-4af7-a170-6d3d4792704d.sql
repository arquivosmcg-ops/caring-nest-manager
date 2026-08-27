ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_funcao_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_funcao_check CHECK (
  funcao IS NULL OR funcao = ANY (ARRAY[
    'medico','enfermeira','enfermeiro','tecnico_enfermagem','cuidador','gerente',
    'fisioterapia','psicologia','nutricao','terapia_ocupacional','fonoaudiologia',
    'servico_social','educacao_fisica','farmacia_clinica','outro'
  ])
);