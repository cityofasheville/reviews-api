
const reviewableTypes = ['CA', 'FT', 'IN', 'PB', 'PN'];
const isReviewable = (e, em) => {
  return (
    e.active === 'A'
    && e[em] !== null && e[em] !== ''
    && e[em].trim().toLowerCase().endsWith('ashevillenc.gov')
    && reviewableTypes.includes(e.ft_status)
  );
};

const notReviewableReason = (e, em) => {
  let reason = null;
  if (!isReviewable(e, em)) {
    if (e.active !== 'A') reason = 'Inactive';
    else if (!reviewableTypes.includes(e.ft_status)) reason = 'Non-included employee type';
    else if (e.position === null || e.position === '') reason = 'No position';
    else if (e[em] === null || !e[em].trim().toLowerCase().endsWith('ashevillenc.gov')) reason = 'City of Asheville email required';
    else reason = 'Employee not registered for Employee Check-in';
  }
  return reason;
};

module.exports = {
  isReviewable,
  notReviewableReason,
};
