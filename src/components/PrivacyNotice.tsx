import type { FC } from 'react';
import { useEffect, useState } from 'react';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';

const STORAGE_KEY = 'privacy_notice_ack';

const PrivacyNotice: FC = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const hasAck = localStorage.getItem(STORAGE_KEY);
    if (!hasAck) {
      setOpen(true);
    }
  }, []);

  const handleClose = () => {
    setOpen(false);
    localStorage.setItem(STORAGE_KEY, '1');
  };

  return (
    <Snackbar
      open={open}
      onClose={handleClose}
      autoHideDuration={8000}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
    >
      <Alert onClose={handleClose} severity="info" variant="filled" sx={{ width: '100%' }}>
        We do not share or store your data. It is 100% secure.
      </Alert>
    </Snackbar>
  );
};

export default PrivacyNotice;


