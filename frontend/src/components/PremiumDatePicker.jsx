import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { useTranslation } from 'react-i18next';
import { forwardRef } from 'react';

// Custom Input for DatePicker to match our Premium UI
const CustomInput = forwardRef(({ value, onClick, placeholder }, ref) => {
    const { i18n } = useTranslation();
    const isRtl = i18n.language === 'ar';
    return (
        <input
            ref={ref}
            className="form-control"
            dir="ltr" // Forces LTR calculation so dates/times don't flip
            style={{
                minHeight: '45px',
                borderRadius: '10px',
                border: '1px solid var(--border-medium)',
                padding: '0.5rem 1rem',
                width: '100%',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: '0.95rem',
                textAlign: isRtl ? 'right' : 'left' // But keeps it aligned to the correct side visually
            }}
            onClick={onClick}
            value={value}
            readOnly
            placeholder={placeholder}
        />
    );
});

const PremiumDatePicker = ({ selected, onChange, placeholder, minDate, showTimeSelect = false }) => {
    const { t, i18n } = useTranslation();
    const isRtl = i18n.language === 'ar';

    const filterPassedTime = (time) => {
        const currentDate = new Date();
        const selectedDate = new Date(time);
        
        return currentDate.getTime() < selectedDate.getTime();
    };

    return (
        <div style={{ width: '100%', position: 'relative' }}>
            <DatePicker
                selected={selected}
                onChange={onChange}
                customInput={<CustomInput placeholder={placeholder} />}
                minDate={minDate}
                showTimeSelect={showTimeSelect}
                filterTime={filterPassedTime}
                timeIntervals={15}
                timeCaption={t('Common.TimeCaption')}
                dateFormat={showTimeSelect ? "dd/MM/yyyy h:mm aa" : "dd/MM/yyyy"}
                wrapperClassName="date-picker-full-width" // Will ensure it spans 100% width
                showPopperArrow={false}
                portalId="root-portal" // Ensures it is not cut off by hidden overflow
                className="premium-calendar"
            />
            {/* Global style overrides for the date picker popup specifically for RTL */}
            <style jsx="true" global="true">{`
                .date-picker-full-width {
                    width: 100%;
                }
                .react-datepicker-popper {
                    z-index: 9999 !important;
                }
                .react-datepicker {
                    font-family: inherit !important;
                    border: none !important;
                    border-radius: 12px !important;
                    box-shadow: 0 15px 35px rgba(0, 0, 0, 0.1) !important;
                    padding: 10px;
                }
                .react-datepicker__header {
                    background-color: white !important;
                    border-bottom: none !important;
                }
                .react-datepicker__day--selected {
                    background-color: var(--primary-color) !important;
                    border-radius: 8px !important;
                }
                .react-datepicker__day:hover {
                    border-radius: 8px !important;
                }
            `}</style>
        </div>
    );
};

export default PremiumDatePicker;
