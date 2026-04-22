import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';
import { useTranslation } from 'react-i18next';

const PremiumSelect = ({ options, value, onChange, placeholder, required, creatable }) => {
    const { t, i18n } = useTranslation();
    const isRtl = i18n.language === 'ar';

    // Styling configuration for react-select to match our premium aesthetic
    const customStyles = {
        control: (provided, state) => ({
            ...provided,
            minHeight: '45px',
            borderRadius: '10px',
            borderColor: state.isFocused ? 'var(--primary-color)' : '#d1d5db',
            boxShadow: state.isFocused ? '0 0 0 4px rgba(79, 70, 229, 0.15)' : 'none',
            backgroundColor: state.isFocused ? '#ffffff' : '#f9fafb',
            transition: 'all 0.3s ease',
            fontFamily: 'inherit',
            fontWeight: '600',
            fontSize: '0.95rem',
            cursor: 'pointer',
            padding: '2px',
            '&:hover': {
                borderColor: 'var(--primary-hover)',
                backgroundColor: '#ffffff',
                boxShadow: '0 4px 10px rgba(79, 70, 229, 0.08)'
            }
        }),
        valueContainer: (provided) => ({
            ...provided,
            padding: isRtl ? '2px 12px 2px 8px' : '2px 8px 2px 12px',
        }),
        input: (provided) => ({
            ...provided,
            margin: '0',
            padding: '0',
        }),
        singleValue: (provided) => ({
            ...provided,
            color: 'var(--text-main)',
        }),
        option: (provided, state) => ({
            ...provided,
            backgroundColor: state.isSelected 
                ? 'var(--primary-color)' 
                : state.isFocused 
                    ? 'rgba(79, 70, 229, 0.05)' 
                    : 'white',
            color: state.isSelected ? 'white' : 'var(--text-main)',
            cursor: 'pointer',
            padding: '0.8rem 1rem',
            fontWeight: state.isSelected ? '700' : '500',
            transition: 'all 0.2s ease',
            borderRadius: '8px',
            marginBottom: '2px', // replaces gap
            '&:active': {
                backgroundColor: 'rgba(79, 70, 229, 0.1)'
            }
        }),
        menu: (provided) => ({
            ...provided,
            borderRadius: '12px',
            boxShadow: '0 15px 35px rgba(0, 0, 0, 0.1), 0 5px 15px rgba(0, 0, 0, 0.05)',
            border: '1px solid #e5e7eb',
            marginTop: '8px'
        }),
        menuPortal: base => ({ ...base, zIndex: 9999 }),
        menuList: (provided) => ({
            ...provided,
            padding: '0.5rem',
            maxHeight: '200px'
        }),
        indicatorSeparator: () => ({
            display: 'none'
        }),
        dropdownIndicator: (provided) => ({
            ...provided,
            color: '#4F46E5',
            '&:hover': {
                color: 'var(--primary-hover)'
            }
        })
    };

    let selectedOption = options.find(opt => String(opt.value) === String(value)) || null;
    if (!selectedOption && value && creatable) {
        selectedOption = { value: value, label: value };
    }

    const Component = creatable ? CreatableSelect : Select;

    return (
        <Component
            styles={customStyles}
            options={options}
            value={selectedOption}
            onChange={(selected) => onChange(selected ? selected.value : '')}
            placeholder={placeholder}
            isClearable={false}
            isSearchable={true}
            required={required}
            classNamePrefix="premium-select"
            isRtl={isRtl}
            noOptionsMessage={() => t('Common.NoOptions')}
            formatCreateLabel={(inputValue) => `${t('Common.Add')} "${inputValue}"`}
            menuPortalTarget={document.body}
            menuPosition="fixed"
        />
    );
};

export default PremiumSelect;
