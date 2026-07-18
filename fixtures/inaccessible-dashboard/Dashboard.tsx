// Intentionally inaccessible: click-only control, unlabeled fields, and unmanaged modal focus.
export const Dashboard = ({ showDialog }) => (
  <div>
    <div onClick={save}>Save</div>
    <input name="email" />
    <img src="/chart.png" />
    <span className="red">!</span>
    {showDialog ? (
      <div className="modal">
        <button onClick={close}>Close</button>
      </div>
    ) : null}
  </div>
);
