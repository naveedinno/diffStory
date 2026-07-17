// "Resolve" kit tab: the raw diff with the Round drawer open — feedback has no
// separate screen; it lives with the code and batches in the drawer.
window.DSKit.FeedbackPanel = function FeedbackPanel(props){
  const A=window.DSKit.AllFilesDiff;
  return <A {...props} drawerOpen/>;
};
