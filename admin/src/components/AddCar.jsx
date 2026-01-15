import React from 'react'
import { AddCarPageStyles, toastStyles } from '../assets/dummyStyles.js';
import axios from 'axios';
import { useRef, useState, useCallback } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import { getAdminToken } from '../utils/auth.js';

const baseURL = 'http://localhost:7889';
const api = axios.create({ baseURL });

const AddCar = () => {
  const initialFormData = {
    carName: "",
    dailyPrice: "",
    seats: "",
    fuelType: "Petrol",
    mileage: "",
    transmission: "Automatic",
    year: "",
    model: "",
    description: "",
    category: "Sedan",
    image: null,
    imagePreview: null,
  };

  const [data, setData] = useState(initialFormData);
  const fileRef = useRef(null);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setData((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleImageChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => setData((prev) => ({ ...prev, image: file, imagePreview: evt.target.result }));
    reader.readAsDataURL(file);
  }, []);

  const resetForm = useCallback(() => {
    setData(initialFormData);
    if (fileRef.current) fileRef.current.value = '';
  }, [initialFormData]);

  const showToast = useCallback((type, title, message, icon) => {
    const toastConfig = { position: "top-right", className: toastStyles[type].container, bodyClassName: toastStyles[type].body };
    toastConfig.autoClose = type === "success" ? 3000 : 4000;
    toast[type](
      <div className="flex items-center">
        {icon}
        <div>
          <p className={type === "success" ? "font-bold text-lg" : "font-semibold"}>{title}</p>
          <p>{message}</p>
        </div>
      </div>, toastConfig
    );
  }, []);

  const validate = () => {
    const required = [
      { key: 'carName', label: 'Car Name' },
      { key: 'dailyPrice', label: 'Daily Price' },
      { key: 'seats', label: 'Seats' },
      { key: 'year', label: 'Year' },
      { key: 'model', label: 'Model' },
    ];
    for (const r of required) {
      const val = data[r.key];
      if (val === '' || val === null || val === undefined) {
        showToast('error', 'Validation', `${r.label} is required`);
        return false;
      }
    }
    if (isNaN(Number(data.dailyPrice)) || Number(data.dailyPrice) <= 0) {
      showToast('error', 'Validation', 'Daily Price must be a positive number'); return false;
    }
    if (isNaN(Number(data.seats)) || Number(data.seats) <= 0) {
      showToast('error', 'Validation', 'Seats must be a positive number'); return false;
    }
    if (isNaN(Number(data.year)) || Number(data.year) < 1900) {
      showToast('error', 'Validation', 'Year is invalid'); return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      const formData = new FormData();
      formData.append("make", data.carName);
      formData.append("dailyRate", Number(data.dailyPrice));
      formData.append("seats", Number(data.seats));
      formData.append("fuelType", data.fuelType);
      formData.append("mileage", data.mileage ? Number(data.mileage) : 0);
      formData.append("transmission", data.transmission);
      formData.append("year", Number(data.year));
      formData.append("model", data.model);
      formData.append("description", data.description || "");
      formData.append("color", "");
      formData.append("category", data.category || "Sedan");
      if (data.image) formData.append("image", data.image);

      const token = getAdminToken();
      if (!token) { showToast('error', 'Auth', 'Please login as admin'); return; }

      const res = await api.post("/api/admin/cars", formData, {
        headers: { Authorization: `Bearer ${token}` } // do not set Content-Type manually
      });

      if (res.data?.success) {
        showToast('success', 'Congratulations!', `Your ${data.carName || 'car'} has been listed`, <svg className={AddCarPageStyles.iconLarge} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg>);
        resetForm();
      } else {
        throw new Error(res.data?.message || 'Unexpected response');
      }
    } catch (err) {
      console.error("Failed to submit car:", err);
      const msg = err.response?.data?.message || err.message || "Failed to list car";
      showToast('error', 'Error', msg, <svg className={AddCarPageStyles.iconMedium} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>);
    }
  };

  return (
    <div className={AddCarPageStyles.pageContainer}>
      <div className={AddCarPageStyles.fixedBackground}>
        <div className={AddCarPageStyles.gradientBlob1}></div>
        <div className={AddCarPageStyles.gradientBlob2}></div>
        <div className={AddCarPageStyles.gradientBlob3}></div>
      </div>

      <div className={AddCarPageStyles.headerContainer}>
        <div className={AddCarPageStyles.headerDivider}><div className={AddCarPageStyles.headerDividerLine}></div></div>
        <h1 className={AddCarPageStyles.title}><span className={AddCarPageStyles.titleGradient}>Add Cars Here</span></h1>
        <p className={AddCarPageStyles.subtitle}>Share your vehicle and start earning today!</p>
      </div>

      <div className={AddCarPageStyles.formContainer}>
        <form onSubmit={handleSubmit} className={AddCarPageStyles.form}>
          <div className={AddCarPageStyles.formGrid}>
            <div className={AddCarPageStyles.formColumn}>
              <label className={AddCarPageStyles.label}>Car Name</label>
              <input required name="carName" value={data.carName} onChange={handleChange} className={AddCarPageStyles.input} placeholder="e.g., Toyota Camry" />

              <label className={AddCarPageStyles.label}>Daily Price (MYR)</label>
              <input required name="dailyPrice" value={data.dailyPrice} onChange={handleChange} type="number" min="1" className={AddCarPageStyles.input} placeholder="150" />

              <label className={AddCarPageStyles.label}>Seats</label>
              <select required name="seats" value={data.seats} onChange={handleChange} className={AddCarPageStyles.select}>
                <option value="">Select seats</option>
                {[2,4,5,6,7,8].map(s => <option key={s} value={s}>{s} seats</option>)}
              </select>

              <label className={AddCarPageStyles.label}>Fuel Type</label>
              <select required name="fuelType" value={data.fuelType} onChange={handleChange} className={AddCarPageStyles.select}>
                {["Petrol","Diesel","Electric","Hybrid","CNG"].map(f => <option key={f} value={f}>{f}</option>)}
              </select>

              <label className={AddCarPageStyles.label}>Mileage (km)</label>
              <input required name="mileage" value={data.mileage} onChange={handleChange} type="number" min="0" className={AddCarPageStyles.input} placeholder="28000" />

              <label className={AddCarPageStyles.label}>Category</label>
              <select required name="category" value={data.category} onChange={handleChange} className={AddCarPageStyles.select}>
                {["Sedan","SUV","Sports","Coupe","Hatchback","Luxury"].map(c => <option key={c} value={c}>{c}</option>)}
              </select>

              <div style={{ marginTop: 12 }}>
                <label className={AddCarPageStyles.label}>Transmission</label>
                <div className={AddCarPageStyles.radioContainer}>
                  {['Automatic','Manual'].map(t => (
                    <label key={t} className={AddCarPageStyles.radioLabel(data.transmission === t)}>
                      <input type="radio" name="transmission" value={t} checked={data.transmission === t} onChange={handleChange} className={AddCarPageStyles.radioInput} />
                      <span className={AddCarPageStyles.radioText}>{t}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className={AddCarPageStyles.formColumn}>
              <label className={AddCarPageStyles.label}>Year</label>
              <input required name="year" value={data.year} onChange={handleChange} type="number" min="1990" max={new Date().getFullYear()} className={AddCarPageStyles.input} placeholder="2020" />

              <label className={AddCarPageStyles.label}>Model</label>
              <input required name="model" value={data.model} onChange={handleChange} className={AddCarPageStyles.input} placeholder="e.g., XLE" />

              <label className={AddCarPageStyles.label}>Car Image</label>
              <div className={AddCarPageStyles.imageUploadContainer}>
                <label className={AddCarPageStyles.imageUploadLabel}>
                  {data.imagePreview ? (
                    <div className='w-full h-full rounded-xl overflow-hidden'>
                      <img src={data.imagePreview} alt='preview' className='w-full h-full object-cover' />
                    </div>
                  ) : (
                    <div className={AddCarPageStyles.imageUploadPlaceholder}>
                      <svg className={AddCarPageStyles.iconUpload} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                      </svg>
                      <p className={AddCarPageStyles.imageUploadText}><span className={AddCarPageStyles.imageUploadTextSemibold}>Click to upload</span><br/>or drag and drop</p>
                      <p className={AddCarPageStyles.imageUploadSubText}>PNG, JPG, up to 5Mb</p>
                    </div>
                  )}
                  <input type='file' ref={fileRef} name="image" onChange={handleImageChange} className='hidden' accept='image/*' />
                </label>
              </div>

              <label className={AddCarPageStyles.label}>Description</label>
              <textarea required name='description' value={data.description} onChange={handleChange} rows='4' className={AddCarPageStyles.textarea} placeholder='Describe features, condition, special details...' />
            </div>
          </div>

          <div className='mt-12 flex justify-center'>
            <button type="submit" className={AddCarPageStyles.submitButton}>
              <span className={AddCarPageStyles.buttonText}>List Your Car</span>
              <svg className={AddCarPageStyles.iconInline} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </button>
          </div>
        </form>
      </div>

      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} closeOnClick pauseOnHover draggable pauseOnFocusLoss theme="dark" />
    </div>
  );
};

export default AddCar;