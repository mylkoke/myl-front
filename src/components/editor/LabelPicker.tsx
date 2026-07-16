/**
 * Selector de "chips" reutilizable. Misma UX que la selección de habilidades en
 * "crear carta". Soporta selección simple (`single`) o múltiple.
 *
 * Genérico en la clave `T extends string` para poder tiparlo con las uniones de
 * `ability.types.ts` (AbilityMoment, AbilityMode, AbilityZone, …).
 */

export type LabelOption<T extends string> = {
  value: T;
  label: string;
  /** Texto opcional en tooltip. */
  title?: string;
};

type BaseProps<T extends string> = {
  options: LabelOption<T>[];
  /** Color del chip activo. */
  tone?: 'sky' | 'purple' | 'emerald' | 'amber';
  className?: string;
};

type SingleProps<T extends string> = BaseProps<T> & {
  multiple?: false;
  value: T | null;
  onChange: (value: T) => void;
};

type MultiProps<T extends string> = BaseProps<T> & {
  multiple: true;
  value: T[];
  onChange: (value: T[]) => void;
};

const TONES = {
  sky: 'bg-sky-500/20 border-sky-400 text-sky-300',
  purple: 'bg-purple-500/20 border-purple-400 text-purple-300',
  emerald: 'bg-emerald-500/20 border-emerald-400 text-emerald-300',
  amber: 'bg-amber-500/20 border-amber-400 text-amber-300',
} as const;

export function LabelPicker<T extends string>(props: SingleProps<T> | MultiProps<T>) {
  const { options, tone = 'sky', className } = props;

  const isActive = (value: T) =>
    props.multiple ? props.value.includes(value) : props.value === value;

  const handleClick = (value: T) => {
    if (props.multiple) {
      const set = new Set(props.value);
      if (set.has(value)) set.delete(value);
      else set.add(value);
      props.onChange([...set]);
    } else {
      props.onChange(value);
    }
  };

  return (
    <div className={['flex flex-wrap gap-2', className].filter(Boolean).join(' ')}>
      {options.map((opt) => {
        const active = isActive(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => handleClick(opt.value)}
            title={opt.title}
            className={[
              'px-2.5 py-1.5 rounded-full text-xs border font-medium transition-all',
              active
                ? TONES[tone]
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500',
            ].join(' ')}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
